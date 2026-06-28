const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

async function main() {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'egip',
    password: env.DB_PASSWORD || 'egip_secret',
    database: env.DB_DATABASE || 'egip',
  });
  await client.connect();
  const { rows } = await client.query(`
    SELECT district_name, district_code,
           ST_NPoints(geometry) AS pts,
           ST_GeometryType(geometry) AS gtype,
           min_lon, min_lat, max_lon, max_lat
    FROM district_boundaries
    WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
    ORDER BY district_name
  `);
  console.log(JSON.stringify(rows, null, 2));
  const state = await client.query(`
    SELECT ST_XMin(ST_Extent(geometry))::float AS min_lon,
           ST_YMin(ST_Extent(geometry))::float AS min_lat,
           ST_XMax(ST_Extent(geometry))::float AS max_lon,
           ST_YMax(ST_Extent(geometry))::float AS max_lat
    FROM district_boundaries
    WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
  `);
  console.log('state bbox:', state.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
