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

  const tables = ['projects', 'divisions', 'users', 'dpr_proposals', 'project_feature_classes', 'gis_layers'];
  const summary = {};

  for (const table of tables) {
    const exists = await client.query(`SELECT to_regclass('public.${table}') AS reg`);
    if (!exists.rows[0]?.reg) {
      summary[table] = { exists: false };
      continue;
    }
    const count = await client.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
        AND column_name IN ('created_at','updated_at','name','project_code')
    `, [table]);
    const colSet = new Set(cols.rows.map((r) => r.column_name));
    let recent = [];
    if (colSet.has('created_at')) {
      const label = colSet.has('name') ? 'name' : colSet.has('project_code') ? 'project_code' : 'id';
      const hasLabel = colSet.has('name') || colSet.has('project_code');
      recent = (await client.query(`
        SELECT ${hasLabel ? label : 'id::text'} AS label, created_at, updated_at
        FROM ${table}
        ORDER BY created_at DESC NULLS LAST
        LIMIT 10
      `)).rows;
    }
    summary[table] = { exists: true, count: count.rows[0].c, recent };
  }

  const jun24 = await client.query(`
    SELECT id, project_code, name, created_at, updated_at
    FROM projects
    WHERE created_at >= '2025-06-24 00:00:00+00'
      AND created_at <= '2025-06-24 21:00:00+00'
    ORDER BY created_at
  `).catch(() => ({ rows: [] }));

  const jun24_2026 = await client.query(`
    SELECT id, project_code, name, created_at, updated_at
    FROM projects
    WHERE created_at >= '2026-06-24 00:00:00+00'
      AND created_at <= '2026-06-24 21:00:00+00'
    ORDER BY created_at
  `).catch(() => ({ rows: [] }));

  console.log(JSON.stringify({ summary, projectsOnJun24_2025: jun24.rows, projectsOnJun24_2026: jun24_2026.rows }, null, 2));
  await client.end();
})().catch((err) => {
  console.error('DB_ERROR:', err.message);
  process.exit(1);
});
