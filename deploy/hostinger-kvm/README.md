# EGIP / S2T2R — Hostinger KVM VPS Deployment

Deploy the [EWUMS](https://github.com/geospatialprp-dotcom/EWUMS) platform on a **Hostinger KVM VPS** (Ubuntu 22.04/24.04) using **Docker Compose** for the app stack and **host Nginx + Certbot** for HTTPS.

## Architecture

```
Internet
   │
   ▼
Host Nginx (:443, Certbot SSL)
   │  proxy_pass → 127.0.0.1:8081
   ▼
Docker: egip-web (nginx + React static)
   │  /api, /uploads → api:3000
   ▼
Docker: egip-api (NestJS)
   ├── postgres (PostGIS 16)
   └── redis 7
```

Optional: `geoserver` profile adds GeoServer on `127.0.0.1:8080` (8 GB+ RAM recommended).

## VPS sizing (Hostinger KVM)

| Plan | RAM | Use case |
|------|-----|----------|
| KVM 2 | 4 GB | API + web + DB (no GeoServer) |
| KVM 4 | 8 GB | Full stack including GeoServer |
| KVM 8 | 16 GB | Production with headroom |

Disk: **40 GB+** (uploads, PostGIS data, Docker images).

---

## Part 1 — Hostinger panel (before SSH)

1. **Order / open KVM VPS** — choose Ubuntu 22.04 LTS (or 24.04).
2. **Note the public IPv4** from hPanel → VPS → Overview.
3. **DNS** — at your domain registrar (or Hostinger DNS):
   - `A` record `@` → VPS IP
   - `A` record `www` → VPS IP (optional)
4. **SSH access** — hPanel → VPS → SSH access:
   - Set root password or add your SSH public key.
   - Default port is usually **22**.

---

## Part 2 — First-time server setup

SSH into the VPS as root:

```bash
ssh root@YOUR_VPS_IP
```

### Option A — Automated bootstrap

```bash
git clone --branch main https://github.com/geospatialprp-dotcom/EWUMS.git /opt/egip
bash /opt/egip/deploy/hostinger-kvm/setup.sh
```

This installs Docker, Docker Compose plugin, Nginx, Certbot, UFW, clones the repo to `/opt/egip`, creates user `egip`, and enables the `egip` systemd unit.

### Option B — Manual steps

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
useradd -m -s /bin/bash egip
usermod -aG docker egip

git clone --branch main https://github.com/geospatialprp-dotcom/EWUMS.git /opt/egip
chown -R egip:egip /opt/egip

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## Part 3 — Environment configuration

```bash
cd /opt/egip/deploy/hostinger-kvm
cp .env.production.example .env
nano .env
```

**Required changes:**

| Variable | Example |
|----------|---------|
| `CORS_ORIGIN` | `https://gis.yourdomain.com` |
| `DB_PASSWORD` | strong random password |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Map Tiles key (optional) |

Rebuild the web container after changing `VITE_*` variables (they are baked in at build time).

---

## Part 4 — Build and start

As user `egip` (or root):

```bash
cd /opt/egip/deploy/hostinger-kvm
bash deploy.sh
```

What `deploy.sh` does:

1. `docker compose build` — builds API and web images
2. Starts `postgres` and `redis`
3. Runs SQL migrations via `migrate` profile
4. Starts `api` and `web`

Verify locally on the VPS:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/
curl -s http://127.0.0.1:3000/api/v1/tenants/current  # expect 401 without token
docker compose -f docker-compose.prod.yml ps
```

Default dev credentials (from seed migrations) — **change passwords in production**:

| Email | Password |
|-------|----------|
| admin@egip.local | Admin@123 |

---

## Part 5 — Host Nginx reverse proxy

```bash
sudo cp /opt/egip/deploy/hostinger-kvm/nginx/egip.conf /etc/nginx/sites-available/egip
sudo sed -i 's/YOUR_DOMAIN/gis.yourdomain.com/g' /etc/nginx/sites-available/egip
sudo ln -sf /etc/nginx/sites-available/egip /etc/nginx/sites-enabled/egip
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Browse `http://gis.yourdomain.com` — you should see the EGIP login page.

---

## Part 6 — SSL with Certbot

```bash
sudo certbot --nginx -d gis.yourdomain.com -d www.gis.yourdomain.com
```

Certbot edits the Nginx site and sets up auto-renewal. Test renewal:

```bash
sudo certbot renew --dry-run
```

Update `.env` so `CORS_ORIGIN` matches your HTTPS URL, then restart API:

```bash
cd /opt/egip/deploy/hostinger-kvm
docker compose -f docker-compose.prod.yml --env-file .env up -d api
```

---

## Part 7 — Process management (systemd)

The setup script installs `/etc/systemd/system/egip.service`:

```bash
sudo systemctl start egip    # start stack on boot
sudo systemctl status egip
sudo systemctl restart egip  # after .env changes (infra only; rebuild with deploy.sh)
```

Docker Compose handles container restarts (`restart: unless-stopped`). Systemd starts the stack after reboot.

---

## Optional — GeoServer

Requires **8 GB+ RAM**. Expose via Nginx only if needed:

```bash
cd /opt/egip/deploy/hostinger-kvm
docker compose -f docker-compose.prod.yml --env-file .env --profile gis up -d geoserver
```

GeoServer admin: `http://127.0.0.1:8080/geoserver` (set credentials in `.env`).

---

## Updates and redeploy

```bash
cd /opt/egip/deploy/hostinger-kvm
git -C /opt/egip pull origin main
bash deploy.sh
```

---

## Optional — GitHub Actions auto-deploy

Workflow: `.github/workflows/deploy-hostinger.yml`

Add repository secrets (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `HOSTINGER_HOST` | VPS public IP or hostname |
| `HOSTINGER_USER` | `egip` |
| `HOSTINGER_SSH_KEY` | Private key (PEM) for deploy user |
| `HOSTINGER_SSH_PORT` | `22` (optional) |

Ensure the `egip` user can run Docker without password and has the deploy key in `~/.ssh/authorized_keys`.

On push to `main`, GitHub SSHs in and runs `deploy.sh`.

---

## Troubleshooting

### Containers not healthy

```bash
cd /opt/egip/deploy/hostinger-kvm
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f api
```

### Migration failed

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile tools run --rm migrate
```

### CORS errors in browser

`CORS_ORIGIN` in `.env` must exactly match the browser URL (scheme + host, no trailing slash).

### Google basemap missing

Set `VITE_GOOGLE_MAPS_API_KEY` in `.env`, then rebuild web:

```bash
docker compose -f docker-compose.prod.yml --env-file .env build web
docker compose -f docker-compose.prod.yml --env-file .env up -d web
```

### Out of disk

```bash
docker system prune -af
```

### Backup database

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U egip egip | gzip > egip-backup-$(date +%F).sql.gz
```

---

## Files in this directory

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production stack (postgres, redis, api, web, migrate, optional geoserver) |
| `docker/Dockerfile.api` | NestJS API image |
| `docker/Dockerfile.web` | Vite build + nginx |
| `docker/nginx-web.conf` | In-container proxy for `/api` and `/uploads` |
| `nginx/egip.conf` | Host Nginx site template |
| `.env.production.example` | Environment template |
| `setup.sh` | First-time VPS bootstrap |
| `deploy.sh` | Build, migrate, restart |
| `systemd/egip.service` | Boot-time Docker Compose unit |

---

## Alternative — without Docker for app tiers

The repo’s root `docker-compose.yml` only runs **infrastructure** (Postgres, Redis, GeoServer). For a non-Docker app deploy:

1. Install Node.js 20 and run `npm ci && npm run build && npm run start:prod` in `backend/api`.
2. Build frontend with `npm run build` in `frontend/web` and serve `dist/` with Nginx.
3. Use `npm run db:migrate` in `backend/api` against a local or Docker Postgres.

Docker Compose for the full stack (as in this guide) is **recommended** on KVM for simpler upgrades and isolation.

---

## Security checklist

- [ ] Change all default passwords (`DB_PASSWORD`, `JWT_SECRET`, GeoServer admin)
- [ ] Restrict SSH (key-only auth, optional non-default port)
- [ ] UFW allows only 22, 80, 443
- [ ] API and web bind to `127.0.0.1` only — public access via Nginx
- [ ] Keep Ubuntu and Docker updated: `apt upgrade`, `docker compose pull` for base images
