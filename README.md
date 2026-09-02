# Staff Shift Scheduler

A web application that solves the shift-scheduling problem with mixed-integer optimization: managers define shifts, employees, skills, and labor rules, and the solver produces a feasible schedule (or explains why the rules contradict each other).

**Learning context:** built by a front-end developer learning backend engineering, databases, DevOps, and mathematical optimization from scratch. Every concept is explained along the way — start with [docs/MONOREPO_BASICS.md](docs/MONOREPO_BASICS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## The stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS + shadcn/ui |
| State | Zustand (client), TanStack Query (server) |
| Backend | NestJS 11 (Node 22) |
| Auth | JWT + bcrypt (Passport.js) |
| Optimization | HiGHS.js — WASM build of the HiGHS MIP/LP solver |
| Database | PostgreSQL + Prisma ORM |
| API contracts | zod, shared via `packages/contracts` |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest, Jest, Playwright |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions on every PR |

One language everywhere: TypeScript.

## Repository layout

```
apps/
  web/        React SPA (never does math)
  api/        NestJS REST API (auth, persistence, orchestration)
  optimizer/  TypeScript + HiGHS.js (ALL mathematical modeling lives here)
packages/
  contracts/  Shared zod schemas — the single source of truth for API shapes
  config/     Shared TypeScript + ESLint configs
docs/         ARCHITECTURE.md, ADRs, DEPLOYMENT.md
e2e/          Playwright end-to-end tests
```

## Quick start (Docker)

The fastest way to run everything:

```bash
git clone https://github.com/your-username/staff-shift-scheduler.git
cd staff-shift-scheduler
docker compose up --build
```

- **Web UI:** http://localhost
- **API:** http://localhost:3000/api/docs (Swagger)
- **Optimizer:** http://localhost:3002/health

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full deployment guide.

## Local development

Requirements: Node.js 22+, pnpm 9+, and Docker Desktop (it runs the PostgreSQL databases).

```bash
docker compose up -d                               # 1. start dev + test databases
pnpm install                                       # 2. install (generates the Prisma client)
pnpm --filter @scheduler/api db:migrate:deploy     # 3. create the schema in the dev database
pnpm dev                                           # 4. run web + api + optimizer together
```

- Web app: http://localhost:5173
- API: http://localhost:3000/api
- API health check: http://localhost:3000/api/health
- Databases: two Postgres 16 containers (dev on host port 5434, tests on 5433 — see [docker-compose.yml](docker-compose.yml) and [docs/DATABASE.md](docs/DATABASE.md))

> In dev, the Vite server proxies `/api` requests to the NestJS api, so the
> browser only ever talks to one origin and CORS never gets in the way.
> `pnpm test` includes integration tests that need the test database up
> (step 1); they fail with instructions if it is not running.

## Authentication

Write endpoints (POST, PATCH, DELETE) require a JWT token. Register or
login to get a token:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"Your Name"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Both return `{ accessToken, user }`. Use the token in subsequent requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{"name":"Barista"}'
```

Read endpoints (GET) are public and don't require authentication.

## Quality commands

```bash
pnpm lint         # ESLint across all packages
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # all unit/integration tests
pnpm test:e2e     # Playwright end-to-end tests
pnpm build        # production builds
pnpm format       # Prettier
```

These run on every PR via GitHub Actions. Run them locally before pushing — don't let CI be your linter.

## How a solve works (in one paragraph)

The web app submits a scheduling problem to the api, which returns a **job id** immediately (a solve can take seconds, and HTTP requests must never block on it). The api forwards the problem to the optimizer service over HTTP; the optimizer builds a mixed-integer model (variables = which employee covers which shift, constraints = coverage/skills/availability/rules, objective = minimize cost plus fairness penalties) and calls HiGHS. The result is one of `optimal`, `feasible`, or `infeasible` — and an infeasible result carries a human-readable list of which rules conflict. Clients poll the job until it finishes, then render the schedule in a calendar UI.

## Documentation

- [docs/ROADMAP.md](docs/ROADMAP.md) — the live progress tracker: what's done, what's in progress, and each milestone's acceptance criteria. **Read this first to see where the project stands.**
- [docs/MILESTONE-REPORTS.md](docs/MILESTONE-REPORTS.md) — one report per completed milestone answering what, when, and why — the story of each milestone in one place
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — how to run the app in Docker containers, from fresh clone to working stack
- [docs/CONCEPT.md](docs/CONCEPT.md) — the narrative overview: what problem this solves, how optimization works, and the full implementation plan
- [docs/DATABASE.md](docs/DATABASE.md) — the teaching guide and setup handbook for the database layer: what a database is, Docker, Prisma, and migrations, explained from scratch — plus the line-by-line tour of our actual setup
- [docs/OPTIMIZATION.md](docs/OPTIMIZATION.md) — how the scheduler actually thinks: what a MIP model is, our variables/constraints/objective line by line, and how infeasibility gets explained
- [docs/MONOREPO_BASICS.md](docs/MONOREPO_BASICS.md) — the guided tour: what a monorepo is, how pnpm workspaces and Turborepo work, every config file explained, and the daily workflow. Read this if the repo mechanics are new to you.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the three services fit together and why: REST, controllers/services/repositories, the request lifecycle, and how a solve actually works
- [docs/FRONTEND.md](docs/FRONTEND.md) — the teaching guide for the web layer: server state vs UI state, TanStack Query polling, shadcn/ui, and contract-validated forms
- [docs/adr/](docs/adr/) — architecture decision records
- [AGENTS.md](AGENTS.md) — the rulebook every AI agent must follow in this repo
