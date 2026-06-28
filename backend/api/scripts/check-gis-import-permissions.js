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

  const mig = await client.query(
    "SELECT filename FROM schema_migrations WHERE filename LIKE '%066%'",
  );
  console.log('migration 066 applied:', mig.rows.length > 0, mig.rows[0]?.filename ?? '');

  const perms = await client.query(`
    SELECT r.code, p.resource, p.action
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.code IN ('ee', 'je', 'ae', 'gis_operator')
      AND p.resource IN ('layer', 'project')
      AND p.action IN ('create', 'update')
    ORDER BY r.code, p.resource, p.action
  `);
  console.log('division GIS perms:', JSON.stringify(perms.rows, null, 2));

  const user = await client.query(`
    SELECT u.email,
           array_agg(DISTINCT r.code ORDER BY r.code) AS roles,
           array_agg(DISTINCT (p.resource || ':' || p.action) ORDER BY (p.resource || ':' || p.action)) AS permissions
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.email LIKE '%kpg%'
    GROUP BY u.email
  `);
  console.log('kpg user:', JSON.stringify(user.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
