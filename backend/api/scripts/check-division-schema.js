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
    SELECT
      to_regclass('public.divisions') AS divisions_table,
      to_regclass('public.user_division_assignments') AS assignments_table,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'division_id'
      ) AS users_division_col,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'division_id'
      ) AS projects_division_col
  `);
  const r = rows[0];
  const ready = Boolean(
    r.divisions_table && r.projects_division_col
    && (r.users_division_col || r.assignments_table),
  );
  console.log('Division schema ready:', ready);
  console.log(JSON.stringify(r, null, 2));
  await client.end();
  process.exit(ready ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
