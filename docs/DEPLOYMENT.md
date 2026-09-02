# Deployment Guide

This guide walks you through running the Staff Shift Scheduler in Docker
containers — from a fresh clone to a working application.

## Prerequisites

- **Docker Desktop** (or Docker Engine + Docker Compose)
- **Git**
- **Node.js 22+** and **pnpm** (for local development only — Docker
  doesn't need them)

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/staff-shift-scheduler.git
cd staff-shift-scheduler

# 2. Start everything
docker compose up --build

# 3. Open the app
#    Web UI:  http://localhost
#    API:     http://localhost:3000/api/docs (Swagger)
#    Optimizer: http://localhost:3002/health
```

That's it! The stack includes:
- **db** — PostgreSQL 16 (dev database, data persists in a volume)
- **api** — NestJS REST API (runs migrations at startup)
- **optimizer** — HiGHS.js model server
- **web** — nginx serving the React SPA + proxying `/api` to the backend

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  web (nginx)│────▶│  api (NestJS)│────▶│ optimizer (HiGHS)│
│  :80        │     │  :3000       │     │  :3002           │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ db (Postgres)│
                    │  :5432       │
                    └─────────────┘
```

- **web** serves the React SPA and proxies `/api/*` requests to the API
- **api** handles CRUD operations, authentication, and orchestrates solves
- **optimizer** runs the mixed-integer programming solver
- **db** stores all persistent data

## Environment Variables

The API requires these environment variables (set in `docker-compose.yml`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://scheduler:scheduler@db:5432/scheduler?schema=public` |
| `OPTIMIZER_BASE_URL` | URL of the optimizer service | `http://optimizer:3002` |
| `PORT` | API listen port | `3000` |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | Set in docker-compose.yml |

## Common Operations

### View logs
```bash
docker compose logs -f api      # Follow API logs
docker compose logs -f optimizer # Follow optimizer logs
docker compose logs -f web       # Follow nginx logs
```

### Restart a service
```bash
docker compose restart api
```

### Stop everything
```bash
docker compose down
```

### Stop and remove volumes (destroys data)
```bash
docker compose down -v
```

### Rebuild after code changes
```bash
docker compose up --build
```

### Run database migrations manually
```bash
docker compose exec api npx prisma migrate deploy
```

### Access the database
```bash
docker compose exec db psql -U scheduler -d scheduler
```

## Local Development (without Docker)

For faster iteration during development, run the services directly:

```bash
# 1. Start the database
docker compose up -d db test-db

# 2. Install dependencies
pnpm install

# 3. Run migrations
pnpm --filter api db:migrate:deploy

# 4. Start all services
pnpm dev
```

This starts:
- Web: http://localhost:5173 (Vite dev server with hot reload)
- API: http://localhost:3000
- Optimizer: http://localhost:3002

## Testing

```bash
# Run all unit and integration tests
pnpm test

# Run E2E tests (requires services running)
pnpm test:e2e

# Run tests for a specific package
pnpm --filter api test
pnpm --filter optimizer test
pnpm --filter web test
```

## Troubleshooting

### Port already in use
If port 5432, 3000, 3002, or 80 is already in use:
- Stop the conflicting service, or
- Change the port mapping in `docker-compose.yml`

### Database connection refused
- Ensure the database container is healthy: `docker compose ps`
- Check logs: `docker compose logs db`
- Wait for the healthcheck to pass (usually 5-10 seconds)

### Migrations fail
- Ensure the database is running and healthy
- Check that `DATABASE_URL` matches the database container
- Run migrations manually: `docker compose exec api npx prisma migrate deploy`

### Optimizer crashes
- Check logs: `docker compose logs optimizer`
- Ensure the HiGHS WASM binaries are present (they're copied during build)

### Web UI shows "Cannot GET /api/..."
- Ensure the API is running: `docker compose ps`
- Check API logs: `docker compose logs api`
- Verify the nginx proxy config: `docker compose exec web cat /etc/nginx/conf.d/default.conf`

## Production Considerations

For a real production deployment, you would also need:

1. **HTTPS**: Add a reverse proxy (Traefik, nginx) with TLS certificates
2. **Secrets management**: Use Docker secrets or a vault for JWT_SECRET
3. **Backup strategy**: Regular database backups
4. **Monitoring**: Health checks, log aggregation, alerting
5. **Scaling**: Multiple API instances behind a load balancer
6. **CI/CD**: Automated builds, tests, and deployments

These are beyond the scope of this learning project but are documented
here for reference.
