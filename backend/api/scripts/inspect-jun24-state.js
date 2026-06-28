const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

(async () => {
  const env = loadEnv();
  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'egip',
    password: env.DB_PASSWORD || 'egip_secret',
    database: env.DB_DATABASE || 'egip',
  });
  await client.connect();

  const divs = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE NOT is_headquarters)::int AS field_divisions,
      COUNT(*) FILTER (WHERE is_headquarters)::int AS hq,
      COUNT(*)::int AS total
    FROM divisions WHERE status = 'active'
  `);

  const projects = await client.query(`
    SELECT p.name, p.project_code, p.created_at, d.name AS division_name, d.code AS division_code
    FROM projects p
    JOIN divisions d ON d.id = p.division_id
    ORDER BY p.created_at
  `);

  const features = await client.query(`
    SELECT p.name AS project, COUNT(pf.id)::int AS feature_count
    FROM projects p
    LEFT JOIN project_feature_classes fc ON fc.project_id = p.id
    LEFT JOIN project_features pf ON pf.feature_class_id = fc.id
    GROUP BY p.id, p.name
    ORDER BY p.name
  `);

  console.log(JSON.stringify({
    divisions: divs.rows[0],
    projects: projects.rows,
    featuresByProject: features.rows,
  }, null, 2));

  await client.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
