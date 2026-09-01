import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  employeeListSchema,
  employeeSchema,
  type EmployeeCreateInput,
} from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { apiEmployeesKeys } from './keys';

/** All employees, ordered by the api (insertion order). */
export function useEmployees() {
  return useQuery({
    queryKey: apiEmployeesKeys.lists(),
    queryFn: () => apiFetch('/api/employees', employeeListSchema),
  });
}

/** Creates an employee; invalidates the list so it refetches. */
export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeCreateInput) =>
      apiFetch('/api/employees', employeeSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiEmployeesKeys.lists() });
    },
  });
}
