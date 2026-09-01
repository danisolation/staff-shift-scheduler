import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

/**
 * Shared render helper for component tests: a fresh QueryClient (retries
 * off, so error states appear immediately) inside a MemoryRouter (pages
 * read routes). Add more providers here as the app grows — never in
 * individual tests.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
      </QueryClientProvider>,
      options,
    ),
  };
}
