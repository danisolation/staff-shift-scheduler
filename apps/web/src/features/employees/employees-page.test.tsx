import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Employee, Skill } from '@scheduler/contracts';
import { renderWithProviders } from '@/lib/test-utils';
import { EmployeesPage } from './employees-page';

/**
 * Routes every fetch the page makes (skills list, employees list, create)
 * and records the create payload so tests can assert the exact
 * contract-shaped body the form produces.
 */
let skills: Skill[];
let employees: Employee[];
let createPayload: unknown;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  skills = [{ id: 'f0000000-0000-4000-8000-000000000001', name: 'Barista' }];
  employees = [];
  createPayload = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/skills')) return jsonResponse(skills);
      if (url.endsWith('/api/employees') && method === 'GET') return jsonResponse(employees);
      if (url.endsWith('/api/employees') && method === 'POST') {
        createPayload = JSON.parse(String(init?.body));
        const created: Employee = {
          id: 'f0000000-0000-4000-8000-00000000000a',
          ...(createPayload as { name: string; skillIds: string[]; availability: Employee['availability']; contractMaxMinutes: number }),
        };
        employees = [...employees, created];
        return jsonResponse(created, 201);
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmployeesPage', () => {
  it('rejects an empty submit without calling the api', async () => {
    renderWithProviders(<EmployeesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /add employee/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2); // name + skills
    expect(createPayload).toBeUndefined();
  });

  it('submits a contract-shaped employee with converted minutes', async () => {
    renderWithProviders(<EmployeesPage />);

    fireEvent.input(await screen.findByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.input(screen.getByLabelText('From'), { target: { value: '08:00' } });
    fireEvent.input(screen.getByLabelText('Until'), { target: { value: '12:00' } });
    fireEvent.input(screen.getByLabelText('Max hours / week'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    await waitFor(() => expect(createPayload).toBeDefined());
    // Hand-computed mapping: "08:00" → 480, "12:00" → 720, 40 h → 2400 min.
    expect(createPayload).toEqual({
      name: 'Ada',
      skillIds: ['f0000000-0000-4000-8000-000000000001'],
      availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
      contractMaxMinutes: 2400,
    });
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });

  it('rejects a window whose end is before its start', async () => {
    renderWithProviders(<EmployeesPage />);

    fireEvent.input(await screen.findByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.input(screen.getByLabelText('From'), { target: { value: '12:00' } });
    fireEvent.input(screen.getByLabelText('Until'), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));
    expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
    expect(createPayload).toBeUndefined();
  });
});
