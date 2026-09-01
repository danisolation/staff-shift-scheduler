/**
 * Query key factory for the employees feature.
 */
export const apiEmployeesKeys = {
  all: ['api', 'employees'] as const,
  lists: () => [...apiEmployeesKeys.all, 'list'],
  detail: (id: string) => [...apiEmployeesKeys.all, 'detail', id],
};
