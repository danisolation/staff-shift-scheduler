# Optimization — How the Scheduler Actually Thinks

This document explains Milestone 3: the mathematical model at the heart of
the project. It is written for a reader who has never seen an optimization
model, using our real code and our real generated model as the worked
example. By the end you will be able to read the LP text the optimizer
produces and know exactly what every line means.

---

## 1. The problem: choosing, under rules

Everything before this milestone was bookkeeping: who exists, what needs
covering, what the database remembers. Milestone 3 answers the actual
question:

> Given employees, their skills, their availability, and their contract
> caps — and given shifts with required skills and headcounts — **who works
> what?** If no assignment satisfies every rule, **which rules clash?**

This is a *decision* problem: thousands of tiny yes/no choices
("does Ada take the Saturday shift?"), bound together by rules. A whole
field exists for exactly this shape of problem.

---

## 2. What a mathematical optimization model is

A model has three parts, and only three:

1. **Variables** — the decisions. Every yes/no question becomes a
   **binary variable**: `x[ada, saturday] = 1` if Ada works Saturday, `0`
   if not. ("Integer" programming = some variables must be whole numbers;
   "mixed" = other variables are allowed to be fractional. Ours is a
   **MIP**, a mixed-integer program.)
2. **Constraints** — the rules, written as linear equations or inequalities
   over the variables. "Saturday needs exactly 2 people" becomes
   `x[ada, sat] + x[sam, sat] + ... = 2`.
3. **Objective** — one linear formula to **minimize** (or maximize),
   scoring a complete assignment: total assigned minutes, plus a fairness
   penalty. The solver searches for the variable values that satisfy every
   constraint and score lowest — and *proves* nothing better exists.

> Frontend analogy: a model is like a component contract taken to the
> extreme. You declare *what* a valid result must look like (constraints)
> and *what* makes one result better than another (objective) — and a
> battle-tested engine finds the answer. You never write the search
> yourself, the same way you never hand-roll a diff algorithm to use
> React's reconciler.

The engine is **HiGHS** — an open-source MIP solver from the University of
Edinburgh, compiled to WebAssembly (`highs` npm package, embedded HiGHS
1.15). It runs in our Node process; no separate solver server until the
architecture asks for one.

---

## 3. Our model, decision by decision

The model lives in `apps/optimizer/src/schedule-model.ts` as a pure
function: `buildScheduleModel(problem, config)` takes typed input and
returns the model as **LP text** — the CPLEX LP file format, a plain-text
language solvers read (see §4). Its JSDoc header states the objective,
constraints, and assumptions; here is the reasoning behind each.

### 3.1 Variables — only where the rules allow

Naively there is one variable per (employee, shift) pair. We do better:
a variable exists **only if the pair is legal**, checked by
`canCover(employee, shift)`:

1. the employee holds **every** skill in `shift.requiredSkillIds`;
2. some availability window of the employee **contains** the shift
   (same `day`, window starts no later than the shift and ends no
   earlier);
3. `contractMaxMinutes` is at least the shift's length (an employee who
   cannot fit a single shift can never take it).

This is **variable pruning**: instead of writing constraints that force
`x = 0` for illegal pairs, those variables simply never exist. The model
is smaller (solvers get exponentially faster with fewer variables), and
the rules are enforced by construction.

> Frontend analogy: rather than rendering a dropdown and validating the
> selection afterwards, you never render the illegal options. Same
> principle — make invalid states unrepresentable.

### 3.2 Constraint: every shift is fully staffed

For each shift `s`:

```
cover_s:  x[e1, s] + x[e2, s] + ... = headcount_s
```

Exactly `headcount_s` people — not "at least", because silently
overstaffing would burn contract minutes the week may need elsewhere. The
model builder throws if a shift has *no* eligible employees (an empty
constraint row is unrepresentable in LP format); the normal flow never
hits that because the diagnoser (§6) catches it first.

### 3.3 Constraint: weekly contract caps

For each employee `e`:

```
hours_e:  240·x[e, s1] + 480·x[e, s2] + ... ≤ contractMaxMinutes_e
```

Each shift contributes its length in minutes when the employee takes it;
the sum may not exceed the cap. This is where "minutes-since-week-start"
pays off — a shift's length is just `endMinute - startMinute`, no date
math anywhere.

### 3.4 Constraint: the fairness variable (the clever bit)

"Employees should share weekend work fairly" is not linear — "similar
counts" involves absolute differences or squares, which a linear solver
cannot read. The standard trick, and the model's one moment of
mathematical inventiveness:

- add **one** continuous variable `maxweekend`;
- for every employee: `maxweekend ≥ (their number of weekend shifts)`;
- put `fairnessWeight · maxweekend` in the objective.

Minimizing the objective pushes `maxweekend` **down**, and it cannot go
below anyone's actual weekend count — so at the optimum it *equals* the
worst-off employee's weekend count. We are minimizing the **maximum**
weekend load. Simple, fully linear, and honest about what it optimizes:
the worst case, not the spread.

### 3.5 The objective — and an honest confession

```
minimize   Σ (shift minutes · x[e, s])  +  fairnessWeight · maxweekend
```

Here is something the codebase says out loud that many codebases would
hide: with exact headcount coverage, the assigned-minutes term is a
**constant** — every solution covers the same `Σ headcount·minutes`
minutes, so "minimize assigned hours" cannot distinguish schedules *by
itself*. The fairness term is what actually chooses. We keep the cost
term anyway: it documents intent, and it becomes meaningful the moment
shifts gain individual costs (pay rates, overtime multipliers). A model
that carries a constant term it doesn't need is still telling the truth —
it's just waiting for the term to matter.

---

## 4. The LP file format — reading a real generated model

HiGHS reads models as text in CPLEX LP format. Here is the **actual**
output of `buildScheduleModel` for the smallest test case (one employee,
one 240-minute shift), reproduced from `schedule-model.test.ts`:

```
Minimize
 obj: 240 x_0_0 + 1 maxweekend
Subject To
 cover_0: x_0_0 = 1
 hours_0: 240 x_0_0 <= 480
Bounds
 maxweekend >= 0
Binaries
 x_0_0
End
```

Line by line:

- `Minimize` / ` obj: ...` — the objective. One binary worth 240 (the
  shift's minutes) and the fairness variable worth 1 (the configured
  `fairnessWeight`).
- `Subject To` — the constraints, each with a name we chose:
  - `cover_0: x_0_0 = 1` — shift 0 needs exactly one person, and only
    employee 0 is eligible.
  - `hours_0: 240 x_0_0 <= 480` — employee 0's weekly cap is 480 minutes;
    this shift uses 240.
- `Bounds` — non-binary variables need ranges; `maxweekend ≥ 0` (it will
  be pushed down to the max weekend count).
- `Binaries` — declares `x_0_0` as a 0/1 variable. This single word is
  what makes the problem *integer* programming.
- `End`.

Naming: LP variable names cannot contain hyphens, and our ids are UUIDs —
so the builder indexes employees and shifts (`x_0_0` = first employee,
first shift) and returns a **registry** mapping each name back to real
ids. Results are read back through that registry; the LP text never leaks
into the API.

---

## 5. The pipeline — four small files, one public function

```
solveSchedule(problem, config)        ← solve-schedule.ts (the public API)
  1. diagnose(problem)                ← diagnose.ts        (pure)
  2. buildScheduleModel(problem, cfg) ← schedule-model.ts  (pure)
  3. runHighs(lpText, cfg)            ← highs-solver.ts    (the only file
  4. map result → SolveOutcome                                that knows HiGHS)
```

- **Pure where it matters**: diagnose and build are pure functions — typed
  in, typed out, no I/O — which is why their tests run in milliseconds
  with no solver loaded.
- **Isolation where it pays**: `highs-solver.ts` is the only file that
  knows HiGHS's quirks (string API, `time_limit` in *seconds*, status
  strings like `'Time limit reached'`). Swapping solvers later touches one
  file — the same payoff the repository interface gave the database.
- **Status honesty**: `Optimal` → `optimal`; `Time limit reached` →
  `feasible` (an incumbent exists, but optimality was not proven);
  infeasible statuses → `infeasible`; **anything else throws**. An
  unknown solver state must never masquerade as a schedule.
- **A safety net, not a hope**: after extraction,
  `solveSchedule` verifies every shift got exactly its headcount before
  returning. If a time-limited solve somehow returned no incumbent, we
  throw — we never present a partial solution as a schedule.

---

## 6. Infeasibility — explaining, not just failing

When the rules contradict, HiGHS says only `Infeasible`. That is
mathematically sufficient and humanly useless. So `diagnose(problem)`
runs **before** the solver and checks the two families simple counting can
prove, producing the actionable messages users need:

1. **Per-shift eligibility**: the shift's pool of eligible employees
   (same three rules as pruning) is smaller than its headcount →
   *"Shift abc… (day 5, minutes 480–720) requires 2 eligible employee(s),
   but only 1 qualify. An eligible employee holds every required skill
   (…), has an availability window covering the shift, and has a contract
   cap of at least 240 minutes."*
2. **Total capacity**: demanded minutes across shifts exceed the combined
   contract minutes → *"The shifts demand 720 covered minutes in total,
   but the employees' contracts allow only 480 minutes combined."*

Messages deliberately keep raw day indices and minutes — the domain rule
is that time formatting lives in the frontend, which will turn "day 5,
minutes 480–720" into "Saturday 08:00–12:00".

If the diagnoser finds nothing and HiGHS still says infeasible, the rules
are jointly contradictory in a way counting cannot see (hour caps
interacting across shifts, typically). The result then says exactly that —
honest about not knowing the culprit, with a hint about which knob to
loosen. **Never fabricate a reason**; a wrong explanation is worse than a
vague one.

---

## 7. How we know it's right: hand-computed tests

Solver code has a nasty failure mode: it confidently returns plausible
garbage. The defense is `solve-schedule.test.ts`, where every expected
number was computed **by hand before running**, with the arithmetic in
the comments:

- one employee, one 240-minute shift → objective exactly **240**;
- skill pruning forces the qualified employee (objective 480);
- a forced Saturday shift adds the fairness penalty (240 + 1 = **241**);
- two identical Saturday shifts split **one per employee** (480 + 1 = 481)
  — the fairness term demonstrably choosing between schedules;
- a contract cap consumed exactly across two shifts (240 + 240 = 480);
- headcount 2 with a pool of 1 → the named per-shift conflict;
- 720 demanded minutes vs 480 of capacity → the capacity conflict.

If the solver disagrees with a hand-computed case, the model is wrong —
and the test says so on the next run.

---

## 8. What comes next (Milestone 4)

The optimizer is now a *library*. Milestone 4 gives it an HTTP face:
`POST` a problem → solve → return the outcome, and the api orchestrates it
asynchronously (create a `SolveJob` row — the table we prepared in
Milestone 2 — return a job id immediately, let clients poll). Long solves
must never block an HTTP request; the pieces are all in place for that.

---

## What I learned — Milestone 3

- **A constant objective term is still worth writing.** The biggest
  surprise of the milestone: with exact coverage, "minimize assigned
  hours" cannot distinguish any two schedules — the number is fixed. The
  fairness variable does all the choosing. Keeping the cost term anyway
  was a deliberate, documented choice (it becomes real when shifts gain
  individual costs), and writing the confession down in the JSDoc forced
  us to actually understand our own objective.
- **Linearization is the core skill of MIP modeling.** "Be fair" is not a
  formula. "minimize the maximum weekend count, via one extra variable
  and one row per employee" is — and it captures a real, explainable
  notion of fairness. The gap between a product wish and a linear
  expression is where modeling thought happens.
- **Pruning beats constraining.** Illegal pairs are simply absent from
  the model — smaller LPs, and rules enforced by construction. Make
  invalid states unrepresentable, solver edition.
- **Read the dependency's own types before coding against it.** The
  status strings, option names (`time_limit` is seconds, not
  milliseconds), and the exact solution shape all came from the installed
  package's `types.d.ts` — zero guessing, and the ambient declaration in
  `highs.d.ts` now documents the quirk for the next reader.
- **Hand-computed expectations are the specification.** Writing 240/480/
  241/481 down *before* running turned the tests into proofs. The solver
  agreed on the first run — not luck, but the natural result of the model
  being simpler than the domain questions around it.
- **Explain infeasibility or don't ship it.** `Infeasible` alone is a
  dead end for a user. The two counting-based families (pool vs headcount,
  demand vs capacity) cover the common causes with actionable messages —
  and where counting can't see the problem, the code says so honestly
  instead of inventing a culprit.
