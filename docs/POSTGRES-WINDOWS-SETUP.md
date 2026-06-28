# PostgreSQL Setup on Windows (Step C)

## What you are doing

1. Create user `egip` with password `egip_secret`
2. Create database `egip`
3. Enable PostGIS and other extensions inside that database

---

## Method 1 — pgAdmin (easiest)

### Part 1: Create user and database

1. Open **pgAdmin 4** (installed with PostgreSQL).
2. Connect to **PostgreSQL 16** (enter your `postgres` password).
3. Right-click **Login/Group Roles** → **Create** → **Login/Group Role**
   - **General** tab → Name: `egip`
   - **Definition** tab → Password: `egip_secret`
   - **Privileges** tab → Can login: **Yes**
   - Click **Save**
4. Right-click **Databases** → **Create** → **Database**
   - Database: `egip`
   - Owner: `egip`
   - Click **Save**

### Part 2: Enable extensions

1. Expand **Databases** → right-click **egip** → **Query Tool**
2. Paste and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT ALL ON SCHEMA public TO egip;
```

3. You should see **Success** for each command.

### Part 3: Load EGIP tables and demo data

Still in Query Tool on database **egip**, run these files in order:

1. `database/migrations/001_platform_schema.sql`
2. `database/migrations/002_seed_data.sql`

In pgAdmin: **File → Open** → select each file → **Execute (F5)**

---

## Method 2 — SQL Shell (psql)

Open **SQL Shell (psql)** from Start menu.

### Create user and database

```
Server [localhost]:
Database [postgres]:
Port [5432]:
Username [postgres]: postgres
Password: (your postgres password)
```

Then run:

```sql
CREATE USER egip WITH PASSWORD 'egip_secret';
CREATE DATABASE egip OWNER egip;
\q
```

### Enable extensions (connect to egip)

Open SQL Shell again, or run:

```powershell
psql -U postgres -d egip
```

Then:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
\q
```

### Load schema and seed data

```powershell
cd C:\Users\Dell\Projects\egip-platform
psql -U egip -d egip -f database\migrations\001_platform_schema.sql
psql -U egip -d egip -f database\migrations\002_seed_data.sql
```

Password when prompted: `egip_secret`

---

## Method 3 — Run project setup scripts

From PowerShell (after PostgreSQL is installed):

```powershell
cd C:\Users\Dell\Projects\egip-platform
.\scripts\setup-postgres.ps1
```

---

## Verify it worked

In pgAdmin Query Tool (database `egip`):

```sql
SELECT PostGIS_Version();
SELECT COUNT(*) FROM users;
```

Expected:
- PostGIS version string (e.g. `3.4 ...`)
- `users` count: **2** (admin and gis demo users)

---

## Next steps

1. Confirm `backend\api\.env` has:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=egip
DB_PASSWORD=egip_secret
DB_DATABASE=egip
```

2. Start backend:

```powershell
cd C:\Users\Dell\Projects\egip-platform\backend\api
npm install
npm run start:dev
```

3. Login at `http://localhost:5173/` with:
   - `admin@egip.local` / `Admin@123`

---

## Common errors

| Error | Fix |
|-------|-----|
| `role "egip" already exists` | User already created — skip CREATE USER |
| `database "egip" already exists` | DB exists — connect to it and run extensions only |
| `extension "postgis" is not available` | Install PostGIS via Stack Builder |
| `permission denied` | Run extension commands as `postgres` user |
| `psql is not recognized` | Add PostgreSQL `bin` folder to PATH, or use pgAdmin |

PostgreSQL `bin` path example:
`C:\Program Files\PostgreSQL\16\bin`
