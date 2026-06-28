/**
 * Load real Uttarakhand district admin boundaries from GeoJSON into district_boundaries.
 * Source: database/gis/uttarakhand-districts-source.geojson (India census 2011 SHP / DIVA-GIS style)
 *
 * Usage: node scripts/import-uttarakhand-districts.js [--generate-sql]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

const DISTRICT_NAME_TO_CODE = {
  Almora: 'ALM',
  Bageshwar: 'BGW',
  Chamoli: 'CHM',
  Champawat: 'CHP',
  Dehradun: 'DDN',
  Haridwar: 'HRW',
  Nainital: 'NTL',
  'Pauri Garhwal': 'PGR',
  Pithoragarh: 'PTG',
  Rudraprayag: 'RDP',
  'Tehri Garhwal': 'TGR',
  'Udham Singh Nagar': 'USN',
  Uttarkashi: 'UTK',
};

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function loadGeoJson() {
  const geoPath = path.join(__dirname, '..', '..', '..', 'database', 'gis', 'uttarakhand-districts-source.geojson');
  if (!fs.existsSync(geoPath)) {
    throw new Error(`Missing source GeoJSON: ${geoPath}`);
  }
  return JSON.parse(fs.readFileSync(geoPath, 'utf8'));
}

function upsertSql(districtCode, districtName, geojsonFeature) {
  const geomJson = JSON.stringify(geojsonFeature.geometry).replace(/'/g, "''");
  return `
INSERT INTO district_boundaries (tenant_id, district_code, district_name, min_lon, min_lat, max_lon, max_lat, geometry)
VALUES (
  '${TENANT_ID}',
  '${districtCode}',
  '${districtName.replace(/'/g, "''")}',
  ST_XMin(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326))),
  ST_YMin(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326))),
  ST_XMax(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326))),
  ST_YMax(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326))),
  ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326)), 3))
)
ON CONFLICT (tenant_id, district_code) DO UPDATE SET
  district_name = EXCLUDED.district_name,
  min_lon = EXCLUDED.min_lon,
  min_lat = EXCLUDED.min_lat,
  max_lon = EXCLUDED.max_lon,
  max_lat = EXCLUDED.max_lat,
  geometry = EXCLUDED.geometry;`;
}

function generateMigrationSql(features) {
  const header = `-- Real Uttarakhand district admin boundaries (2011 census SHP / DIVA-GIS style)
-- Source: database/gis/uttarakhand-districts-source.geojson
-- Replaces demo ST_MakeEnvelope rectangles from migration 062.

ALTER TABLE district_boundaries
  ALTER COLUMN geometry TYPE GEOMETRY(Geometry, 4326)
  USING ST_SetSRID(geometry, 4326);

CREATE INDEX IF NOT EXISTS idx_district_boundaries_geom
  ON district_boundaries USING GIST (geometry);

`;

  const body = features.map((feature) => {
    const districtName = feature.properties.district;
    const districtCode = DISTRICT_NAME_TO_CODE[districtName];
    if (!districtCode) {
      throw new Error(`Unknown district in source GeoJSON: ${districtName}`);
    }
    return upsertSql(districtCode, districtName, feature);
  }).join('\n');

  return header + body + '\n';
}

async function importToDatabase(features) {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'egip',
    password: env.DB_PASSWORD || 'egip_secret',
    database: env.DB_DATABASE || 'egip',
  });

  await client.connect();
  await client.query(`
    ALTER TABLE district_boundaries
      ALTER COLUMN geometry TYPE GEOMETRY(Geometry, 4326)
      USING ST_SetSRID(geometry, 4326)
  `).catch(() => {});
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_district_boundaries_geom
      ON district_boundaries USING GIST (geometry)
  `);

  for (const feature of features) {
    const districtName = feature.properties.district;
    const districtCode = DISTRICT_NAME_TO_CODE[districtName];
    if (!districtCode) {
      throw new Error(`Unknown district in source GeoJSON: ${districtName}`);
    }
    const geomJson = JSON.stringify(feature.geometry);
    await client.query(
      `INSERT INTO district_boundaries (tenant_id, district_code, district_name, min_lon, min_lat, max_lon, max_lat, geometry)
       SELECT
         $1::uuid, $2, $3,
         ST_XMin(ST_Envelope(g))::float,
         ST_YMin(ST_Envelope(g))::float,
         ST_XMax(ST_Envelope(g))::float,
         ST_YMax(ST_Envelope(g))::float,
         ST_Multi(ST_CollectionExtract(ST_MakeValid(g), 3))
       FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326) AS g) sub
       ON CONFLICT (tenant_id, district_code) DO UPDATE SET
         district_name = EXCLUDED.district_name,
         min_lon = EXCLUDED.min_lon,
         min_lat = EXCLUDED.min_lat,
         max_lon = EXCLUDED.max_lon,
         max_lat = EXCLUDED.max_lat,
         geometry = EXCLUDED.geometry`,
      [TENANT_ID, districtCode, districtName, geomJson],
    );
    console.log(`  imported ${districtName} (${districtCode})`);
  }

  const { rows } = await client.query(
    `SELECT
       ST_XMin(ST_Extent(geometry))::float AS min_lon,
       ST_YMin(ST_Extent(geometry))::float AS min_lat,
       ST_XMax(ST_Extent(geometry))::float AS max_lon,
       ST_YMax(ST_Extent(geometry))::float AS max_lat,
       COUNT(*)::int AS district_count
     FROM district_boundaries
     WHERE tenant_id = $1 AND geometry IS NOT NULL`,
    [TENANT_ID],
  );
  console.log('State extent from imported polygons:', rows[0]);
  await client.end();
}

async function main() {
  const geojson = loadGeoJson();
  const features = geojson.features ?? [];
  if (features.length !== 13) {
    console.warn(`Expected 13 districts, found ${features.length}`);
  }

  if (process.argv.includes('--generate-sql')) {
    const sql = generateMigrationSql(features);
    const outPath = path.join(__dirname, '..', '..', '..', 'database', 'migrations', '065_uttarakhand_admin_district_boundaries.sql');
    fs.writeFileSync(outPath, sql, 'utf8');
    console.log(`Wrote ${outPath} (${(sql.length / 1024).toFixed(1)} KB)`);
    return;
  }

  console.log(`Importing ${features.length} Uttarakhand district boundaries...`);
  await importToDatabase(features);
  console.log('Import complete.');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
