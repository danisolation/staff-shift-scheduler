import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Shift } from '@scheduler/contracts';
import { renderWithProviders } from '@/lib/test-utils';
import { ShiftsPage } from './shifts-page';

let shifts: Shift[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  shifts = [];
  createPayload = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/skills')) {
        return jsonResponse([{ id: 'f0000000-0000-4000-8000-000000000001', name: 'Barista' }]);
      }
      if (url.endsWith('/api/shifts') && method === 'GET') return jsonResponse(shifts);
      if (url.endsWith('/api/shifts') && method === 'POST') {
        createPayload = JSON.parse(String(init?.body));
        const created: Shift = {
          id: 'f0000000-0000-4000-8000-00000000000b',
          ...(createPayload as Omit<Shift, 'id'>),
        };
        shifts = [...shifts, created];
        return jsonResponse(created, 201);
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
});

let createPayload: unknown;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ShiftsPage', () => {
  it('submits a contract-shaped shift with converted minutes', async () => {
    renderWithProviders(<ShiftsPage />);

    // Pick Saturday from the Radix Select.
    fireEvent.click(await screen.findByRole('combobox', { name: 'Day' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Saturday' }));

    fireEvent.input(screen.getByLabelText('From'), { target: { value: '08:00' } });
    fireEvent.input(screen.getByLabelText('Until'), { target: { value: '12:00' } });
    fireEvent.click(await screen.findByRole('checkbox')); // Barista
    fireEvent.input(screen.getByLabelText('People needed'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));

    await waitFor(() => expect(createPayload).toBeDefined());
    // Hand-computed: Saturday = day 5, "08:00" → 480, "12:00" → 720.
    expect(createPayload).toEqual({
      day: 5,
      startMinute: 480,
      endMinute: 720,
      requiredSkillIds: ['f0000000-0000-4000-8000-000000000001'],
      headcount: 2,
    });
    // The shift appears in the list (the window label is unique — the
    // Radix Select's hidden fallback also contains day names).
    expect(await screen.findByText('08:00–12:00')).toBeInTheDocument();
  });

  it('rejects a shift whose end is before its start', async () => {
    renderWithProviders(<ShiftsPage />);

    fireEvent.input(await screen.findByLabelText('From'), { target: { value: '12:00' } });
    fireEvent.input(screen.getByLabelText('Until'), { target: { value: '08:00' } });
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));

    expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
    expect(createPayload).toBeUndefined();
  });
});
