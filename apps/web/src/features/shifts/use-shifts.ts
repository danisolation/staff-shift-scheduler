import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shiftListSchema, shiftSchema, type ShiftCreateInput } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { apiShiftsKeys } from './keys';

/** All shifts, ordered by the api (insertion order). */
export function useShifts() {
  return useQuery({
    queryKey: apiShiftsKeys.lists(),
    queryFn: () => apiFetch('/api/shifts', shiftListSchema),
  });
}

/** Creates a shift; invalidates the list so it refetches. */
export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShiftCreateInput) =>
      apiFetch('/api/shifts', shiftSchema, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiShiftsKeys.lists() });
    },
  });
}
