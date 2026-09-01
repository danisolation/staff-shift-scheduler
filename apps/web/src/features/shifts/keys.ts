/**
 * Query key factory for the shifts feature.
 */
export const apiShiftsKeys = {
  all: ['api', 'shifts'] as const,
  lists: () => [...apiShiftsKeys.all, 'list'],
  detail: (id: string) => [...apiShiftsKeys.all, 'detail', id],
};
