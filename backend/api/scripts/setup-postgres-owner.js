const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = { PG_OWNER_USER: 'postgres', PG_OWNER_PASSWORD: '' };
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

async function applySql(client, filename) {
  const sqlPath = path.join(__dirname, '..', '..', '..', 'database', 'migrations', filename);
  if (!fs.existsSync(sqlPath)) {
    console.log('skip missing', filename);
    return;
  }
  const { rows } = await client.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename],
  );
  if (rows.length) {
    console.log('skip already applied', filename);
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('apply', filename, '...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [filename],
    );
    await client.query('COMMIT');
    console.log('done', filename);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const env = loadEnv();
  const password = process.env.PG_OWNER_PASSWORD || env.PG_OWNER_PASSWORD;
  if (!password) {
    console.error('Set PG_OWNER_PASSWORD in .env or environment.');
    process.exit(1);
  }

  const owner = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.PG_OWNER_USER || 'postgres',
    password,
    database: env.DB_DATABASE || 'egip',
  });
  await owner.connect();

  await owner.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  try {
    await owner.query('ALTER TABLE users OWNER TO egip');
    console.log('users table owner set to egip');
  } catch (err) {
    console.warn('ALTER OWNER skipped:', err.message);
  }

  try {
    await owner.query(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES divisions(id) ON DELETE SET NULL',
    );
    console.log('users.division_id column ensured');
  } catch (err) {
    console.warn('division_id column:', err.message);
  }

  try {
    await owner.query(`
      UPDATE users u SET division_id = uda.division_id
      FROM user_division_assignments uda
      WHERE uda.user_id = u.id AND u.division_id IS NULL
    `);
    console.log('synced division_id from user_division_assignments');
  } catch (err) {
    console.warn('sync divisions:', err.message);
  }

  for (const file of [
    '046_ujs_divisions_access.sql',
    '047_ujs_rbac_governance_framework.sql',
  ]) {
    try {
      await applySql(owner, file);
    } catch (err) {
      console.warn(file, 'failed:', err.message);
    }
  }

  const check = await owner.query(`
    SELECT tableowner FROM pg_tables WHERE tablename = 'users'
  `);
  console.log('users owner:', check.rows[0]?.tableowner);
  await owner.end();
  console.log('Postgres owner setup complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
