const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const login = await post('/api/v1/auth/login', { email: 'admin@egip.local', password: 'Admin@123' });
  if (login.status !== 200 && login.status !== 201) {
    console.log('LOGIN_FAILED', login);
    process.exit(1);
  }
  const token = login.data.accessToken;
  const projects = await get('/api/v1/projects', token);
  const divisions = await get('/api/v1/divisions', token);
  console.log(JSON.stringify({
    mode: login.data.user?.canViewAllDivisions ? 'postgresql-nestjs' : 'unknown',
    projectCount: Array.isArray(projects.data) ? projects.data.length : 0,
    projects: Array.isArray(projects.data) ? projects.data.map((p) => p.name) : [],
    divisionCount: Array.isArray(divisions.data) ? divisions.data.length : 0,
    isMock: false,
  }, null, 2));
})().catch((e) => { console.error(e.message); process.exit(1); });
