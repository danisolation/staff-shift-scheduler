/**
 * Query key factory for the schedule feature (solve jobs).
 */
export const apiSolvesKeys = {
  all: ['api', 'solves'] as const,
  detail: (jobId: string) => [...apiSolvesKeys.all, 'detail', jobId],
};
