/**
 * Query key factory for the skills feature. The stable string roots live
 * here (never inline in components), so invalidation targets stay
 * consistent as the app grows.
 */
export const apiSkillsKeys = {
  all: ['api', 'skills'] as const,
  lists: () => [...apiSkillsKeys.all, 'list'],
};
