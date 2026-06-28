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

  const cutoff = '2026-06-24 15:30:00+00'; // ~9 PM IST

  const counts = {};
  for (const table of [
    'project_features', 'construction_daily_dpr', 'construction_mb_entries',
    'construction_boq_items', 'construction_work_packages', 'gis_map_access_logs',
  ]) {
    const reg = await client.query(`SELECT to_regclass('public.${table}') AS r`);
    if (!reg.rows[0]?.r) { counts[table] = null; continue; }
    const total = await client.query(`SELECT COUNT(*)::int c FROM ${table}`);
    const before = await client.query(`SELECT COUNT(*)::int c FROM ${table} WHERE created_at <= $1`, [cutoff]).catch(() => ({ rows: [{ c: null }] }));
    counts[table] = { total: total.rows[0].c, atOrBefore9pmIst: before.rows[0].c };
  }

  const features = await client.query(`
    SELECT pf.id, p.name AS project_name, fc.name AS class_name, pf.created_at
    FROM project_features pf
    JOIN project_feature_classes fc ON fc.id = pf.feature_class_id
    JOIN projects p ON p.id = fc.project_id
    ORDER BY pf.created_at DESC
    LIMIT 20
  `).catch(() => ({ rows: [] }));

  const backups = await client.query(`
    SELECT filename, applied_at FROM schema_migrations
    WHERE applied_at >= '2026-06-24' OR applied_at <= '2026-06-24 15:30:00+00'
    ORDER BY applied_at DESC LIMIT 15
  `).catch(() => ({ rows: [] }));

  console.log(JSON.stringify({ cutoffNote: '9pm IST ~= 2026-06-24 15:30 UTC', counts, features: features.rows, recentMigrations: backups.rows }, null, 2));
  await client.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
