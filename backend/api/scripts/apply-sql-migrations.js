/**
 * Apply SQL migrations from database/migrations/ using node pg (no psql required).
 * Usage: node scripts/apply-sql-migrations.js [012 013]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const fileEnv = {};
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) fileEnv[m[1].trim()] = m[2].trim();
    }
  }
  // Docker Compose injects DB_* via env_file/environment; prefer process.env.
  const out = { ...fileEnv };
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      out[key] = process.env[key];
    }
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
  const requested = process.argv.slice(2);
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => !requested.length || requested.some((id) => f.includes(id)));

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file],
    );
    if (rows.length) {
      console.log(`skip ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}...`);
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`done ${file}`);
  }

  await client.end();
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message || String(err));
  if (err.detail) console.error('Detail:', err.detail);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
