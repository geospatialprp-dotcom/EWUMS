/**
 * Restore PostgreSQL from a .sql dump file.
 * Usage: npm run db:restore -- database/backups/egip-YYYYMMDD-HHMM.sql
 *
 * WARNING: Overwrites current database contents.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('Usage: node scripts/restore-database.js <path-to-backup.sql>');
  process.exit(1);
}

const resolved = path.resolve(dumpPath);
if (!fs.existsSync(resolved)) {
  console.error('Backup file not found:', resolved);
  process.exit(1);
}

const env = loadEnv();
const psql = process.env.PSQL || 'psql';

const args = [
  '-h', env.DB_HOST || 'localhost',
  '-p', String(env.DB_PORT || 5432),
  '-U', env.DB_USERNAME || 'egip',
  '-d', env.DB_DATABASE || 'egip',
  '-v', 'ON_ERROR_STOP=1',
  '-f', resolved,
];

console.log('Restoring from:', resolved);
const result = spawnSync(psql, args, {
  env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || 'egip_secret' },
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) {
  console.error('Restore failed:', result.stderr || result.stdout);
  process.exit(1);
}

console.log('Restore completed successfully.');
