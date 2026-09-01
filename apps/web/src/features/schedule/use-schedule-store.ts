import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Pure UI state for the schedule page (never server data — that lives in
 * TanStack Query, see lib/query-client.ts). The active job id survives a
 * page refresh via sessionStorage, so a solve that is still running keeps
 * polling after the user navigates away and back.
 */
interface ScheduleUiState {
  activeJobId: string | null;
  setActiveJob: (jobId: string) => void;
  clearActiveJob: () => void;
}

export const useScheduleStore = create<ScheduleUiState>()(
  persist(
    (set) => ({
      activeJobId: null,
      setActiveJob: (activeJobId) => set({ activeJobId }),
      clearActiveJob: () => set({ activeJobId: null }),
    }),
    {
      name: 'schedule-ui',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ activeJobId: state.activeJobId }),
    },
  ),
);
