import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shiftListSchema, shiftSchema, type ShiftCreateInput } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { apiShiftsKeys } from './keys';

/** All shifts, ordered by the api (insertion order). */
export function useShifts() {
  const { token } = useAuth();
  return useQuery({
    queryKey: apiShiftsKeys.lists(),
    queryFn: () => apiFetch('/api/shifts', shiftListSchema, { token }),
  });
}

/** Creates a shift; invalidates the list so it refetches. */
export function useCreateShift() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: ShiftCreateInput) =>
      apiFetch('/api/shifts', shiftSchema, { method: 'POST', body: JSON.stringify(input), token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiShiftsKeys.lists() });
    },
  });
}
