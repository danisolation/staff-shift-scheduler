# Database — What Milestone 2 Is For

This document explains the *why* before the *how*. It covers every concept
Milestone 2 introduces, from scratch, for a reader with frontend experience
and no database background. During the milestone, this same document grows
the step-by-step setup sections, so by the end it is also the complete
handbook.

---

## 1. The problem Milestone 1 left behind

Everything the api stores today lives in a JavaScript `Map` inside the Node
process. That works for learning the layering pattern, but it has two
fatal flaws:

1. **Restart the api and everything is gone.** Employees, skills, shifts —
   wiped. We saw this live during smoke testing: after each server restart,
   skill ids from earlier requests returned `400 Unknown skill id`.
2. **Only one process can see the data.** Real deployments run several
   copies of the api at once (for scale and reliability). Each copy would
   have its own private `Map`, and they would disagree with each other.

> Frontend analogy: in-memory storage is like keeping all your app state in
> a component's local `useState`. It's fine while the component lives, but
> it disappears on every refresh, and no other component can read it. A
> database is the equivalent of `localStorage` or a real backend — except
> orders of magnitude more powerful and reliable.

Milestone 2 fixes exactly this: **persistence** — data that lives outside
your process, in a system built to store it, query it, and protect its
integrity.

---

## 2. Concept: what a relational database is

A **database** is software whose entire job is storing and retrieving data
reliably. A **relational database** is the classic kind, and it models data
as **tables**.

### Tables, columns, rows

You already know tables — they're spreadsheets:

- A **table** is one kind of entity. We'll have `Skill`, `Employee`,
  `Shift`, and (later) `SolveJob`.
- **Columns** are the fields. `Skill` has `id` and `name`; `Employee` has
  `id`, `name`, `contractMaxMinutes`.
- **Rows** are individual records: one row = one "Barista" skill.

The difference from a spreadsheet is that a database enforces *rules* about
the table: column types, required fields, uniqueness — and relationships.

### Primary keys

Every table needs a way to name one specific row unambiguously. That
column is the **primary key** — for us, a UUID (the same ids you already
see in the API responses). Two rows can have the same `name`; they can
never have the same `id`.

### Relations and foreign keys

This is the "relational" part. A column in one table can *point at* a row
in another table, by holding that row's primary key. That column is a
**foreign key**.

Today, `Employee.skillIds` is just an array of strings in memory — nothing
stops it from containing a made-up id (which is why we hand-wrote the
`assertSkillsExist` check in the service). In the database, an employee's
skills become **join table** rows: a `EmployeeSkill` table with two foreign
keys — `employeeId` pointing at `Employee`, `skillId` pointing at `Skill`.
One row = "this employee has this skill". An employee with three skills has
three join rows.

### Referential integrity — the database polices your rules

Because the database *knows* `EmployeeSkill.skillId` points at `Skill.id`,
it can **guarantee** that every referenced skill exists. If code tries to
insert a join row with a nonexistent skill id, the database refuses —
instantly, at the lowest possible layer. This guarantee is **referential
integrity**.

This is the same rule we hand-wrote in `EmployeesService`. The database
version is stronger: it applies to *every* code path, forever, even future
ones nobody has written yet. You cannot forget to check, because the
database checks for you.

> Frontend analogy: referential integrity is like TypeScript's type system,
> but for data. Your code can't even *express* a broken reference — the
> "compiler" (the database) rejects it at the boundary.

---

## 3. Concept: PostgreSQL

**PostgreSQL** (pronounced "post-gres-Q-L", often just "Postgres") is the
most respected open-source relational database. It has been in continuous
development since 1996, is free, and powers a huge share of serious
production systems. The alternatives exist (MySQL, SQLite) and are
legitimate, but Postgres is the safe industry default for a new project —
and it's the one this repo's stack commits to.

How it runs: Postgres is its own **process** (a program running on the
machine), listening on a port (5432 by default). Your api doesn't import
Postgres like a library; it connects over the network and speaks SQL — the
Structured Query Language. "Run Postgres" therefore means "have a Postgres
process running somewhere, reachable from your api."

> Frontend analogy: your api calling Postgres is exactly like your React
> app calling a REST API — the database is a *server* your backend talks
> to. The api is the client; Postgres is the service.

---

## 4. Concept: Docker and containers

Postgres is a native program, and installing it by hand on Windows is
miserable — installers, Windows services, PATH setup, permission files.
Docker exists to make "run a program like Postgres" trivial and identical
everywhere.

### The two words you must know

- **Image** — a *recipe* for a complete mini-filesystem with a program
  preinstalled and preconfigured. The Postgres image contains a Linux
  filesystem with Postgres installed. Images are downloaded from a registry
  (Docker Hub) or built from a recipe file (a `Dockerfile`).
- **Container** — a *running instance* of an image. Like a class vs. an
  object, or a component definition vs. a mounted component. Containers are
  lightweight (they share the host kernel), so running one is like starting
  a process, not booting a VM.

> Frontend analogy: an image is the npm package; a container is the running
> app. You `pull` (install) the image once, then start as many containers
> as you like from it.

### Docker Compose — the recipe for a whole stack

**docker-compose.yml** is a declarative file: "run a Postgres 16 container,
with this username/password, expose port 5432, and keep its data in a named
**volume**."

A **volume** is the piece that makes data survive: containers are
*disposable by design* — deleting a container deletes its filesystem. A
volume is persistent storage mounted into the container, so the database
files live outside the disposable part. `docker compose up` starts
everything; `docker compose down` stops it; `docker compose down -v`
deletes the data too (the nuclear option).

Why Docker, honestly? Three reasons: (1) identical environment for every
developer and for CI — no "works on my machine"; (2) Postgres setup becomes
one file + one command; (3) this is how real teams run databases in
development, so you're learning the actual industry workflow.

---

## 5. Concept: Prisma — an ORM

An **ORM** (Object-Relational Mapper) bridges two worlds that don't natively
speak the same language: your TypeScript code works with *objects*; a
relational database works with *tables*. Without an ORM you'd write raw SQL
strings, and every query would be untyped and stringly-validated — bugs
appear only at runtime, when the database complains.

**Prisma** is one of the two dominant Node ORMs (the other is Drizzle). Its
workflow:

1. You describe your tables in one file, `prisma/schema.prisma` — a
   domain-specific language that reads almost like English:

   ```prisma
   model Skill {
     id   String @id @default(uuid())
     name String @unique
   }
   ```

   This one block declares a table, its columns, its primary key, and a
   uniqueness rule.

2. Prisma **generates** a TypeScript client from that file. You get fully
   typed queries with zero effort:

   ```ts
   const skills = await prisma.skill.findMany();   // Skill[] — typed
   const one = await prisma.skill.findUnique({ where: { id } }); // Skill | null
   ```

3. If you later change the schema (rename a column, add a table), code
   using it breaks as **type errors** at compile time — not as runtime
   database errors. The compiler finds every place that needs updating,
   exactly like the contract-first workflow did for API shapes.

Why not raw SQL? You absolutely should learn SQL eventually — it's the
foundation everything sits on. But for a project whose goal is correctness
and learning at the right pace, the ORM's type safety and readability pay
off immediately, and Prisma is what most production NestJS codebases use.

> Frontend analogy: Prisma is to the database what your typed API client
> is to the backend — instead of hand-writing `fetch` calls and guessing
> shapes, you get functions with real types generated from one source of
> truth.

---

## 6. Concept: migrations — version control for your table structure

Your table structure *changes* over time. You add a `SolveJob` table in
Milestone 4; maybe employees gain a `preferredHours` column later. Every
database that runs your app must end up with the *same* structure — dev
machines, CI, production.

A **migration** is a versioned, ordered list of schema changes — like git
commits, but for table structure. The workflow with Prisma:

1. Edit `schema.prisma` (the desired state).
2. Run `prisma migrate dev`. Prisma diffs the desired state against the
   database, generates the change as a migration file (SQL plus metadata),
   and applies it. You commit the migration to git.
3. Anyone else (or CI) runs `prisma migrate deploy` — their database is
   brought up to the same state, in order.

The rule this creates: **never edit a database by hand.** The schema file
is the source of truth; migrations are its history. Hand-editing creates a
database that no longer matches the schema, and the drift shows up as
mysterious failures later. This is the database version of "never edit
generated code."

> Frontend analogy: migrations are your lockfile + git history combined.
> Like a lockfile guarantees everyone installs identical dependencies,
> migrations guarantee every database has identical structure.

---

## 7. The payoff you've already earned

Remember the repository *interfaces* from Milestone 1 (`SkillRepository`,
`EmployeeRepository`, `ShiftRepository`) — services depend on the
interface, never on the in-memory class.

Milestone 2 writes new implementations — `PrismaSkillRepository` etc. —
that talk to Postgres, then swaps **one provider line per module**:

```ts
// before
{ provide: SKILL_REPOSITORY, useClass: InMemorySkillRepository }
// after
{ provide: SKILL_REPOSITORY, useClass: PrismaSkillRepository }
```

Controllers and services do not change at all. That was the entire point
of the layering: storage is a detail behind an interface, and now the
detail gets upgraded. This swap — in-memory to real database without
touching business logic — is a textbook demonstration of why the layering
exists, and it's the main thing to watch happen in this milestone.

---

## 8. What the milestone delivers

From `docs/ROADMAP.md`:

- `docker-compose.yml` at the repo root: Postgres for dev, plus a separate
  **test database** (tests must never touch your dev data).
- Prisma schema in `apps/api/prisma/schema.prisma`: `Skill`, `Employee`,
  `Shift`, the `EmployeeSkill` join table, availability windows (as a child
  table), and a `SolveJob` table prepared for Milestone 4. First migration
  committed.
- Prisma repositories implementing the existing interfaces; a typed
  `ConfigModule` for the database connection string (no scattered
  `process.env`).
- Integration tests against the real test database.

**Acceptance criteria:** data survives api restarts; `pnpm test` includes
the integration tests; migrations are committed.

**This document** gets the step-by-step sections during the work: how to
install/start Docker, the exact compose file line-by-line, the full schema
file line-by-line, and the migration workflow. It ends as the complete
handbook, and the milestone ends with its "What I learned".

---

## What to learn next (after this milestone)

- What SQL itself looks like — the language underneath Prisma (the
  migration files are literal SQL, a perfect first look).
- What indexes are, and why "find by id" is fast.
- What transactions are, and why "do three things or none of them" matters.
UNICCS VIỆT NAM