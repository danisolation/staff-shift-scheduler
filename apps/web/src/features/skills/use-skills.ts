import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillListSchema, skillSchema, type SkillCreateInput } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { apiSkillsKeys } from './keys';

/** All skills — the list employees and shifts reference. */
export function useSkills() {
  const { token } = useAuth();
  return useQuery({
    queryKey: apiSkillsKeys.lists(),
    queryFn: () => apiFetch('/api/skills', skillListSchema, { token }),
  });
}

/** Creates a skill; invalidates the list so it refetches. */
export function useCreateSkill() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: (input: SkillCreateInput) =>
      apiFetch('/api/skills', skillSchema, { method: 'POST', body: JSON.stringify(input), token }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiSkillsKeys.lists() });
    },
  });
}
