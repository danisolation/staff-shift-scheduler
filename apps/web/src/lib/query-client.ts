import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide QueryClient. Server state (fetched from the api) lives here —
 * caching, retries and refetching are TanStack Query's job, never Zustand's.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
