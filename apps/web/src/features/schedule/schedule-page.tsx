import type { SolveResult } from '@scheduler/contracts';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { useEmployees } from '../employees/use-employees';
import { useShifts } from '../shifts/use-shifts';
import { ScheduleCalendar } from './schedule-calendar';
import { useScheduleStore } from './use-schedule-store';
import { useSolveJob, useSolveMutation } from './use-solve';

/**
 * The schedule page: submits everything currently stored as a solve
 * problem, polls the job, and renders the finished week. The status views
 * mirror the api's job lifecycle: queued/running (polling), optimal/feasible
 * (calendar), infeasible (conflicts), failed (message + retry).
 */
export function SchedulePage() {
  const employees = useEmployees();
  const shifts = useShifts();
  const solve = useSolveMutation();
  const activeJobId = useScheduleStore((state) => state.activeJobId);
  const setActiveJob = useScheduleStore((state) => state.setActiveJob);
  const clearActiveJob = useScheduleStore((state) => state.clearActiveJob);
  const job = useSolveJob(activeJobId);

  const hasData =
    employees.data !== undefined &&
    shifts.data !== undefined &&
    employees.data.length > 0 &&
    shifts.data.length > 0;

  const onRun = (): void => {
    if (employees.data === undefined || shifts.data === undefined) {
      return;
    }
    solve.mutate(
      { employees: employees.data, shifts: shifts.data },
      { onSuccess: (created) => setActiveJob(created.jobId) },
    );
  };

  // The job's status and result are independent schema fields, so both are
  // narrowed here, once, into consts the JSX can rely on (narrowing of
  // property chains does not survive into render closures).
  const solved: Extract<SolveResult, { status: 'optimal' | 'feasible' }> | undefined =
    job.data?.result !== undefined && job.data.result.status !== 'infeasible'
      ? job.data.result
      : undefined;
  const infeasible: Extract<SolveResult, { status: 'infeasible' }> | undefined =
    job.data?.result !== undefined && job.data.result.status === 'infeasible'
      ? job.data.result
      : undefined;
  const isPolling = job.data?.status === 'queued' || job.data?.status === 'running';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground">
          Runs the optimizer over every employee and shift, then shows the week it produced.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Run the scheduler</CardTitle>
          <CardDescription>
            Uses all stored employees and shifts. Shifts are staffed exactly to their
            headcount with qualified, available people; weekend work is balanced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasData && (
            <p className="text-muted-foreground text-sm">
              Add at least one employee and one shift first (Skills → Employees → Shifts).
            </p>
          )}
          <Button onClick={onRun} disabled={!hasData || solve.isPending}>
            {solve.isPending ? 'Submitting…' : 'Run scheduler'}
          </Button>
          {solve.isError && (
            <p role="alert" className="text-destructive text-sm">{solve.error.message}</p>
          )}
        </CardContent>
      </Card>

      {activeJobId === null && !solve.isPending && (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            No solve yet — run the scheduler above and the week will appear here.
          </CardContent>
        </Card>
      )}

      {activeJobId !== null && job.isPending && (
        <Card aria-busy>
          <CardHeader>
            <CardTitle>Checking job status…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </CardContent>
        </Card>
      )}

      {activeJobId !== null && job.isError && (
        <Card>
          <CardContent>
            <p role="alert" className="text-destructive text-sm">{job.error.message}</p>
          </CardContent>
        </Card>
      )}

      {isPolling && (
        <Card aria-busy>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Solving
              <Badge variant="secondary">{job.data?.status}</Badge>
            </CardTitle>
            <CardDescription>
              The optimizer is working — this page polls until the job finishes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-3/4" />
          </CardContent>
        </Card>
      )}

      {solved !== undefined && employees.data !== undefined && shifts.data !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              This week's schedule
              <Badge variant={job.data?.status === 'optimal' ? 'default' : 'secondary'}>
                {job.data?.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {job.data?.status === 'optimal'
                ? 'Objective score '
                : 'A valid schedule (optimality not proven — the solver hit its time limit). Objective score '}
              {solved.objectiveValue}
              {job.data?.status === 'optimal' &&
                ' — lower is better (assigned minutes plus the weekend-balance penalty).'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScheduleCalendar
              employees={employees.data}
              shifts={shifts.data}
              assignments={solved.assignments}
            />
            <Button variant="outline" onClick={clearActiveJob}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {infeasible !== undefined && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">The rules conflict</CardTitle>
            <CardDescription>
              No schedule can satisfy every constraint. Each reason below names what to change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-1 pl-5">
              {infeasible.conflicts.map((conflict) => (
                <li key={conflict} className="text-sm">{conflict}</li>
              ))}
            </ul>
            <Button variant="outline" onClick={clearActiveJob}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {job.data?.status === 'failed' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Solve failed</CardTitle>
            <CardDescription>{job.data.message ?? 'The solver reported an error.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearActiveJob}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
