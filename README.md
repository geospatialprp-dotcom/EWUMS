# Enterprise GIS Intelligence Platform (EGIP)

Cloud-native, multi-tenant enterprise GIS platform integrating asset management, surveys, projects, IoT, digital twins, and AI decision support.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, MUI, OpenLayers, Cesium (3D) |
| Backend | NestJS, GraphQL + REST |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Cache | Redis 7 |
| GIS | GeoServer, GeoWebCache, Vector Tiles |
| Deploy | Docker, Kubernetes |

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 20+

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Run database migrations

```bash
docker compose exec postgres psql -U egip -d egip -f /docker-entrypoint-initdb.d/001_platform_schema.sql
```

### 3. Start backend

```bash
cd backend/api
npm install
npm run start:dev
```

API: http://localhost:3000  
Swagger: http://localhost:3000/api/docs

### 4. Start frontend

```bash
cd frontend/web
npm install
npm run dev
```

App: http://localhost:5173

## Default Credentials (Development)

| Email | Password | Role |
|-------|----------|------|
| admin@egip.local | Admin@123 | Super Administrator |
| gis@egip.local | Gis@123 | GIS Administrator |
| manager@egip.local | Manager@123 | Asset Manager |
| viewer@egip.local | Viewer@123 | Viewer (read-only) |

## Features

### Web GIS Map Explorer
- OpenLayers interactive map with asset visualization
- Layer catalog with toggle controls
- Map tools: identify, measure distance, draw point/area
- Feature popup with asset health and status

### User Management & RBAC
- Create, edit, deactivate users
- Role-based access control with granular permissions
- Roles: Super Admin, GIS Admin, Asset Manager, Viewer

### Workflow Engine
- Multi-step approval workflows for assets, layers, projects, user provisioning
- Workflow inbox with approve/reject actions
- Submit new workflow requests
- Track submission status

### Executive Dashboard
- KPI cards, project progress charts, asset status pie chart
- Critical assets table, IoT alerts feed

### Audit Trail
- Complete activity logging for compliance
- User actions, workflow events, resource changes

## API Endpoints

- `POST /api/v1/auth/login` — Authenticate
- `GET  /api/v1/users` — List users (requires user:read)
- `POST /api/v1/users` — Create user (requires user:create)
- `GET  /api/v1/roles` — List roles with permissions
- `GET  /api/v1/workflows/inbox` — Pending workflow tasks
- `POST /api/v1/workflows/submit` — Submit workflow request
- `POST /api/v1/workflows/tasks/:id/act` — Approve/reject task
- `GET  /api/v1/audit/logs` — Audit trail (requires audit:read)
- `GET  /api/v1/assets` — List assets (spatial filter supported)
- `POST /api/v1/assets/spatial-query` — Buffer/intersect analysis
- `GET  /api/v1/gis/layers` — Layer catalog
- `GET  /api/v1/tenants/current` — Current tenant info
- `GET  /api/v1/dashboard/executive` — Executive KPIs

```
egip-platform/
├── backend/api/          # NestJS API gateway & services
├── frontend/web/         # React PWA
├── database/migrations/  # PostGIS schema
├── gis/                  # GeoServer config
├── industry-packs/       # Pluggable domain modules
├── infrastructure/       # K8s & Terraform
└── docker-compose.yml
```

Run migration 003 for workflows:

```bash
docker compose exec postgres psql -U egip -d egip -f /docker-entrypoint-initdb.d/003_workflows.sql
```

## Project Structure

## License

Proprietary — Enterprise GIS Intelligence Platform
