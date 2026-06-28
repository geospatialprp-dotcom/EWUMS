/**
 * Apply UJS division migration and verify schema.
 * Tries 046 first; on "must be owner of table users" applies 048 (no ALTER users).
 */
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

function clientFrom(env, useOwner = false) {
  return new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: useOwner ? (env.PG_OWNER_USER || 'postgres') : (env.DB_USERNAME || 'egip'),
    password: useOwner ? (env.PG_OWNER_PASSWORD || '') : (env.DB_PASSWORD || 'egip_secret'),
    database: env.DB_DATABASE || 'egip',
  });
}

async function isReady(client) {
  const { rows } = await client.query(`
    SELECT
      to_regclass('public.divisions') AS divisions_table,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'division_id'
      ) AS projects_division_col,
      (
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'division_id'
        )
        OR to_regclass('public.user_division_assignments') IS NOT NULL
      ) AS users_division_ready
  `);
  const row = rows[0] ?? {};
  return Boolean(row.divisions_table && row.projects_division_col && row.users_division_ready);
}

async function applySqlFile(client, filename) {
  const sqlPath = path.join(__dirname, '..', '..', '..', 'database', 'migrations', filename);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(`
      INSERT INTO schema_migrations (filename)
      VALUES ($1)
      ON CONFLICT (filename) DO NOTHING
    `, [filename]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const env = loadEnv();
  const app = clientFrom(env, false);
  await app.connect();

  await app.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (await isReady(app)) {
    console.log('Division schema already ready.');
    await app.end();
    return;
  }

  const already046 = await app.query(
    "SELECT 1 FROM schema_migrations WHERE filename = '046_ujs_divisions_access.sql'",
  );
  const already048 = await app.query(
    "SELECT 1 FROM schema_migrations WHERE filename = '048_ujs_divisions_assignments_fallback.sql'",
  );

  if (!already046.rows.length) {
    console.log('Applying migration 046_ujs_divisions_access.sql as app user...');
    try {
      await applySqlFile(app, '046_ujs_divisions_access.sql');
      console.log('Migration 046 applied successfully.');
      if (await isReady(app)) {
        await app.end();
        return;
      }
    } catch (err) {
      console.warn('Migration 046 failed:', err.message);
    }
  }

  if (!already048.rows.length && !(await isReady(app))) {
    console.log('Applying fallback migration 048 (user_division_assignments, no ALTER users)...');
    try {
      await applySqlFile(app, '048_ujs_divisions_assignments_fallback.sql');
      console.log('Migration 048 applied successfully.');
    } catch (err) {
      console.error('Migration 048 failed:', err.message);
      await app.end();
      process.exit(1);
    }
  }

  if (await isReady(app)) {
    console.log('Division schema is ready.');
    await app.end();
    return;
  }

  await app.end();

  if (env.PG_OWNER_USER || env.PG_OWNER_PASSWORD) {
    const owner = clientFrom(env, true);
    await owner.connect();
    console.log(`Retrying 046 as ${env.PG_OWNER_USER || 'postgres'}...`);
    await owner.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await applySqlFile(owner, '046_ujs_divisions_access.sql');
    console.log('Migration applied successfully as owner.');
    await owner.end();
    return;
  }

  console.error(`
Division setup incomplete. Add PG_OWNER_USER/PG_OWNER_PASSWORD to .env or run in pgAdmin:
  ALTER TABLE users OWNER TO egip;
`);
  process.exit(1);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
