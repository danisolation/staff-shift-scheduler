import { useMutation, useQuery } from '@tanstack/react-query';
import { solveJobSchema, type SolveJob, type SolveRequest } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { apiSolvesKeys } from './keys';

/**
 * Submits the schedule problem. Returns the job immediately (status
 * "queued") — the api runs the solve in the background (ADR-005).
 */
export function useSolveMutation() {
  return useMutation({
    mutationFn: (problem: SolveRequest) =>
      apiFetch('/api/solves', solveJobSchema, {
        method: 'POST',
        body: JSON.stringify(problem),
      }),
  });
}

/** How often a queued/running job is re-fetched. */
const POLL_INTERVAL_MS = 1000;

/**
 * Polls one solve job until it reaches a terminal status: while the api
 * says "queued" or "running" the query refetches every second; once the
 * status is terminal (optimal/feasible/infeasible/failed) polling stops.
 */
export function useSolveJob(jobId: string | null) {
  return useQuery({
    queryKey: apiSolvesKeys.detail(jobId ?? 'none'),
    enabled: jobId !== null,
    queryFn: () => {
      if (jobId === null) {
        throw new Error('No active solve job');
      }
      return apiFetch(`/api/solves/${jobId}`, solveJobSchema);
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? POLL_INTERVAL_MS : false;
    },
  }) satisfies ReturnType<typeof useQuery<SolveJob>>;
}
