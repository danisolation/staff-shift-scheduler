import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillListSchema, skillSchema, type SkillCreateInput } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { apiSkillsKeys } from './keys';

/** All skills — the list employees and shifts reference. */
export function useSkills() {
  return useQuery({
    queryKey: apiSkillsKeys.lists(),
    queryFn: () => apiFetch('/api/skills', skillListSchema),
  });
}

/** Creates a skill; invalidates the list so it refetches. */
export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillCreateInput) =>
      apiFetch('/api/skills', skillSchema, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiSkillsKeys.lists() });
    },
  });
}
