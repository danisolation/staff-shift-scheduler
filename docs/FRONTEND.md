# Frontend — Server State, UI State, and the Week on Screen

This document explains Milestone 5: the web app finally talking to the api.
It is written for the repo's owner (a front-end developer) but walks through
every pattern the way the other handbooks do (MONOREPO_BASICS, DATABASE,
OPTIMIZATION), because this layer is where several ideas meet.

---

## 1. The problem Milestone 5 solves

After Milestone 4 the whole pipeline worked — over HTTP, with curl. The web
app, though, could only show a health check. This milestone connects the UI
to that pipeline: create skills, employees, and shifts in forms; run the
scheduler; poll the job; render the finished week on a calendar.

The engineering question underneath: **where does each piece of state
live?** A page like Schedule has employees (fetched), shifts (fetched), a
solve job (fetched, changing every second while it runs), and one tiny UI
fact (which job the user is watching). Three different homes, three
different tools.

---

## 2. The two kinds of state (and the third thing that isn't state)

> Frontend analogy: TanStack Query is to REST what React Query fans already
> know — but the real analogy is `useState` vs `useContext`: the tool should
> match the *ownership* of the data, not the shape.

- **Server state** — data the api owns (employees, shifts, jobs). The UI
  only *caches* it. **TanStack Query** owns fetching, caching, retries,
  invalidation, and polling. If the api changed it, Query must find out —
  that's what invalidation is for.
- **UI state** — data the user owns with no server counterpart: "which job
  is this page watching". **Zustand** holds exactly this (one store,
  `features/schedule/use-schedule-store.ts`, persisted to sessionStorage so
  a refresh keeps watching a running job).
- **Derived values are not state**: "does the shift form have valid times"
  is computed from form fields — react-hook-form owns form state, and the
  *validation rules* come from `@scheduler/contracts` (zod), not from
  hand-written checks that could drift from the api.

The split is written down in `lib/query-client.ts`: server state in Query,
never Zustand.

---

## 3. Feature folders — the shape of every feature

Every feature follows the dashboard's original pattern, extended:

```
features/<name>/
├── keys.ts          # query key factory: { all, lists(), detail(id) }
├── use-<name>.ts    # useQuery/useMutation hooks (fetch + zod parse)
├── <name>-form.tsx  # react-hook-form + zodResolver(contract schema)
└── <name>-page.tsx  # composition: form + list/table, status views
```

- **Key factories** keep invalidation targets stable: `useCreateSkill`
  invalidates `apiSkillsKeys.lists()`, and the list query re-runs. Strings
  are never inlined in components.
- **`lib/api-client.ts`** is the single boundary to the api: `apiFetch(path,
  schema, init)` throws `ApiError` (built from the api's error envelope) on
  any non-2xx and **parses every success response against the shared zod
  schema** before a component ever sees it. Wrong shapes fail at the
  boundary, loudly.
- **Forms speak the contract**: the employee/shift forms use
  `zodResolver(<contract create schema>)` where the shapes match, and a
  local form schema mirroring the contract where the input widgets need
  different units (time inputs produce "HH:MM" strings). On submit the
  values are converted (via `lib/time.ts`) and **re-validated with
  `employeeCreateSchema.parse(...)`** before the request leaves — the
  contract stays the boundary even when the form speaks in time strings.

---

## 4. shadcn/ui — primitives, not a design system dependency

`src/ui/` holds generated shadcn/ui components (button, input, label,
select, field, card, badge, skeleton, table). They are *code you own* —
copied into the repo by the shadcn CLI, styled with Tailwind using the
theme tokens in `index.css` (Tailwind v4 `@theme inline`). Two consequences
worth knowing:

- There is no versioned component library to fight; the components are
  yours to edit. The cost is you also own their updates.
- The components import from `radix-ui` (the unified package) for
  accessible behavior (focus management, keyboard support in the Select)
  — styling is Tailwind, behavior is Radix.

Note: the 2025-era shadcn registry replaced the old `form` component with
`field`-based composition; this repo's forms use plain `Label` + `Input` +
inline error paragraphs (`role="alert"`), which is simpler to read and to
test.

---

## 5. Polling — the job lifecycle on screen

`useSolveJob(jobId)` shows the whole pattern in one hook:

```ts
useQuery({
  queryKey: apiSolvesKeys.detail(jobId ?? 'none'),
  enabled: jobId !== null,
  queryFn: () => apiFetch(`/api/solves/${jobId}`, solveJobSchema),
  refetchInterval: (query) =>
    query.state.data?.status === 'queued' || query.state.data?.status === 'running'
      ? 1000   // still working — ask again in a second
      : false, // terminal — stop polling
});
```

The page's status views mirror the api's lifecycle exactly: pending check →
error → `queued`/`running` (skeletons + status badge) → `optimal`/`feasible`
(calendar + objective score) → `infeasible` (red card listing every
conflict from the solver's diagnoser) → `failed` (message + try again).
The UI never invents a state the api doesn't report.

---

## 6. The time rule, enforced by a function

The domain stores minutes-since-week-start (day 0–6, minute-of-day). The
frontend is the only place that formats them — and `lib/time.ts` is the
only place that knows how. `dayName`, `formatMinutesOfDay`,
`formatShiftWindow`, `formatMinutesAsWeeklyHours`, and their inverse
`parseMinutesOfDay` are pure and unit-tested with hand-computed values.
The functions **throw on impossible inputs** — which caught a real bug
during the milestone (a weekly cap of 2400 minutes passed to the
clock-time formatter) before it could display "40:00" as if it were a
time of day.

---

## 7. Testing — hermetic, no mock server

- `lib/test-utils.tsx` renders with a fresh QueryClient (retries off) and a
  MemoryRouter.
- `fetch` is stubbed per test (`vi.stubGlobal`) with a routing mock that
  answers by URL + method and records POST bodies — so tests assert the
  **exact contract-shaped payloads** the forms produce (e.g. "08:00" →
  `startMinute: 480`).
- Radix components need jsdom stubs (`hasPointerCapture` etc.) — they live
  in `vitest.setup.ts`.
- Vitest pins `NODE_ENV: 'test'` in `vite.config.ts`: React 19.2 removed
  `act` from its production build, so an ambient `NODE_ENV=production`
  would break every component test.

---

## 8. What to learn next (Milestone 6)

Auth (the api gains register/login and guards), Playwright driving the
real journey in a real browser, and Docker for the whole stack — the UI
grows a login screen and stops trusting the network.
