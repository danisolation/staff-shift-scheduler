import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/lib/test-utils';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('shows the welcome message', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
  });
});
