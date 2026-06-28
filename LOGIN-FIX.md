# Login Fix Guide

## Your error

```
Docker Desktop is unable to start
```

Docker is not running, so `docker compose up -d` cannot start PostgreSQL. **Login will fail until something is listening on port 3000.**

---

## Option A — Login NOW (no Docker) ✅ Recommended

### Step 1: Open a new PowerShell terminal

### Step 2: Run the mock API server

```powershell
cd C:\Users\Dell\Projects\egip-platform\backend\api
node dev-server.js
```

You should see:

```
EGIP DEV API running on http://localhost:3000
No database required. Demo login: admin@egip.local / Admin@123
```

**Keep this terminal open.**

### Step 3: Login in browser

Go to `http://localhost:5173/` and sign in:

| Email | Password |
|-------|----------|
| admin@egip.local | Admin@123 |

Map/asset data will be empty until you have a real database. Login and navigation will work.

**Or double-click:** `scripts\start-login-only.bat`

---

## Option B — Fix Docker Desktop (for full app with data)

1. **Open Docker Desktop** from the Start menu
2. Wait until it shows **"Docker Desktop is running"** (whale icon in system tray)
3. If it won't start, try:
   - Restart your PC
   - Enable **WSL 2** (Docker Desktop → Settings → General → Use WSL 2)
   - Run Docker Desktop **as Administrator**
   - Check Windows features: **Virtual Machine Platform** and **Windows Subsystem for Linux** enabled
4. When Docker is running, use the **light** database stack (no GeoServer):

```powershell
cd C:\Users\Dell\Projects\egip-platform
docker compose -f docker-compose.dev.yml up -d
```

5. Start full backend:

```powershell
cd backend\api
npm install
npm run start:dev
```

---

## Option C — Full stack with GeoServer (later)

Only after Docker works reliably:

```powershell
docker compose up -d
```

GeoServer needs more RAM (2–4 GB). Skip it until you need WMS/WFS publishing.

---

## Verify services

```powershell
netstat -ano | findstr "LISTENING" | findstr "3000 5173"
```

| Port | Service | Required for login |
|------|---------|-------------------|
| 5173 | Frontend | Yes |
| 3000 | Backend API | Yes |
| 5432 | PostgreSQL | Only for full data |

---

## Summary

| Problem | Solution |
|---------|----------|
| Docker won't start | Use `node dev-server.js` — no Docker needed |
| Login failed | Backend not on port 3000 — start dev-server |
| Want real map data | Fix Docker → `docker-compose.dev.yml` → `npm run start:dev` |
