const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: `/api/v1${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const login = await request('POST', '/auth/login', { email: 'admin@egip.local', password: 'Admin@123' });
  if (login.status !== 201 && login.status !== 200) {
    console.log('LOGIN FAIL', login.status, login.data);
    process.exit(1);
  }
  const token = login.data.accessToken;
  for (const ep of [
    '/om/billing/catalog',
    '/om/billing/summary',
    '/om/billing/tariffs',
    '/om/billing/accounts?projectCode=PRJ-2026-001',
    '/om/billing/gis-revenue?projectCode=PRJ-2026-001',
  ]) {
    const res = await request('GET', ep, null, token);
    console.log(res.status === 200 ? 'OK' : 'FAIL', ep, res.status);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
