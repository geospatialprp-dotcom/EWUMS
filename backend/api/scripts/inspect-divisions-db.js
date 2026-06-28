const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
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

  const divisions = await client.query(`
    SELECT id, code, name, is_headquarters
    FROM divisions
    WHERE status = 'active'
    ORDER BY is_headquarters DESC, name
  `);

  const projects = await client.query(`
    SELECT p.id, p.project_code, p.name, p.division_id, d.name AS division_name
    FROM projects p
    LEFT JOIN divisions d ON d.id = p.division_id
    ORDER BY p.name
  `);

  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'division_id'
  `);

  console.log(JSON.stringify({
    divisionSchemaReady: cols.rows.length > 0,
    divisionCount: divisions.rows.length,
    divisions: divisions.rows,
    projectCount: projects.rows.length,
    projects: projects.rows,
  }, null, 2));

  await client.end();
})().catch((err) => {
  console.error('DB_ERROR:', err.message);
  process.exit(1);
});
