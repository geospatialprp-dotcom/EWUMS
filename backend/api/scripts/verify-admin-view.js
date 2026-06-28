const BASE = 'http://localhost:3000/api/v1';

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@egip.local', password: 'Admin@123' }),
  });
  const { accessToken } = await login.json();

  const [divRes, projRes] = await Promise.all([
    fetch(`${BASE}/divisions`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch(`${BASE}/projects`, { headers: { Authorization: `Bearer ${accessToken}` } }),
  ]);

  const divisions = await divRes.json();
  const projects = await projRes.json();

  const field = divisions.filter((d) => !d.isHeadquarters);

  console.log(JSON.stringify({
    apiMode: 'postgresql',
    divisionsReturned: divisions.length,
    fieldDivisions: field.length,
    divisionNames: field.map((d) => d.name),
    projectsReturned: projects.length,
    projects: projects.map((p) => ({
      name: p.name,
      division: p.divisionName ?? p.divisionId,
      status: p.status,
    })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
