/**
 * Backup PostgreSQL database to database/backups/
 * Usage: npm run db:backup
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

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const env = loadEnv();
const root = path.join(__dirname, '..', '..', '..');
const backupDir = path.join(root, 'database', 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const outfile = path.join(backupDir, `egip-${stamp()}.sql`);
const pgDump = process.env.PG_DUMP || 'pg_dump';

const args = [
  '-h', env.DB_HOST || 'localhost',
  '-p', String(env.DB_PORT || 5432),
  '-U', env.DB_USERNAME || 'egip',
  '-d', env.DB_DATABASE || 'egip',
  '-F', 'p',
  '-f', outfile,
  '--no-owner',
  '--no-privileges',
];

const result = spawnSync(pgDump, args, {
  env: { ...process.env, PGPASSWORD: env.DB_PASSWORD || 'egip_secret' },
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error('pg_dump failed:', result.stderr || result.stdout || `exit ${result.status}`);
  console.error('\nInstall PostgreSQL client tools or set PG_DUMP to full path.');
  process.exit(1);
}

console.log(`Backup saved: ${outfile}`);
console.log(`Size: ${(fs.statSync(outfile).size / 1024 / 1024).toFixed(2)} MB`);
