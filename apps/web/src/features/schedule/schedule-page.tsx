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
        <h1 className="text-3xl font-bold">Schedule</h1>
        <p className="mt-2 text-muted-foreground">
          Run the optimizer to generate the best schedule for your team.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Run the Scheduler</CardTitle>
          <CardDescription>
            Uses all stored employees and shifts. Shifts are staffed exactly to their
            headcount with qualified, available people; weekend work is balanced.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasData && (
            <div className="rounded-md bg-muted p-4 text-sm">
              <p className="font-medium">No data yet</p>
              <p className="mt-1 text-muted-foreground">
                Add at least one employee and one shift first (Skills → Employees → Shifts).
              </p>
            </div>
          )}
          <Button onClick={onRun} disabled={!hasData || solve.isPending} size="lg">
            {solve.isPending ? 'Submitting...' : 'Run Scheduler'}
          </Button>
          {solve.isError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {solve.error.message}
            </div>
          )}
        </CardContent>
      </Card>

      {activeJobId === null && !solve.isPending && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <p className="text-muted-foreground">
              No solve yet — run the scheduler above and the week will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {activeJobId !== null && job.isPending && (
        <Card aria-busy>
          <CardHeader>
            <CardTitle>Checking job status...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </CardContent>
        </Card>
      )}

      {activeJobId !== null && job.isError && (
        <Card>
          <CardContent>
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {job.error.message}
            </div>
          </CardContent>
        </Card>
      )}

      {isPolling && (
        <Card aria-busy>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Solving
              <Badge variant="secondary">{job.data?.status}</Badge>
            </CardTitle>
            <CardDescription>
              The optimizer is working — this page polls until the job finishes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-3/4" />
          </CardContent>
        </Card>
      )}

      {solved !== undefined && employees.data !== undefined && shifts.data !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              This Week's Schedule
              <Badge variant={job.data?.status === 'optimal' ? 'default' : 'secondary'}>
                {job.data?.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {job.data?.status === 'optimal'
                ? 'Objective score '
                : 'A valid schedule (optimality not proven — the solver hit its time limit). Objective score '}
              <span className="font-mono font-medium">{solved.objectiveValue}</span>
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
              Clear Schedule
            </Button>
          </CardContent>
        </Card>
      )}

      {infeasible !== undefined && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <span>⚠️</span>
              The Rules Conflict
            </CardTitle>
            <CardDescription>
              No schedule can satisfy every constraint. Each reason below names what to change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {infeasible.conflicts.map((conflict) => (
                <li key={conflict} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 text-destructive">•</span>
                  {conflict}
                </li>
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
            <CardTitle className="text-destructive flex items-center gap-2">
              <span>❌</span>
              Solve Failed
            </CardTitle>
            <CardDescription>{job.data.message ?? 'The solver reported an error.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearActiveJob}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
