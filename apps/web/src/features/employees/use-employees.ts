import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  employeeListSchema,
  employeeSchema,
  type EmployeeCreateInput,
} from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { apiEmployeesKeys } from './keys';

/** All employees, ordered by the api (insertion order). */
export function useEmployees() {
  const { token } = useAuth();
  return useQuery({
    queryKey: apiEmployeesKeys.lists(),
    queryFn: () => apiFetch('/api/employees', employeeListSchema, { token }),
  });
}

/** Creates an employee; invalidates the list so it refetches. */
export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: EmployeeCreateInput) =>
      apiFetch('/api/employees', employeeSchema, {
        method: 'POST',
        body: JSON.stringify(input),
        token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiEmployeesKeys.lists() });
    },
  });
}
