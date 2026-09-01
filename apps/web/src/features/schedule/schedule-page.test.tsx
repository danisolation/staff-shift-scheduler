import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Employee, Shift, SolveJob } from '@scheduler/contracts';
import { renderWithProviders } from '@/lib/test-utils';
import { useScheduleStore } from './use-schedule-store';
import { SchedulePage } from './schedule-page';

/**
 * The full page journey with a scripted api: GET employees/shifts return
 * real contract shapes; POST /api/solves answers "queued" with a job id;
 * every later GET of that job answers with the per-test job response —
 * proving the page's submit → poll → render cycle against the contract.
 */
const SKILL_ID = 'f0000000-0000-4000-8000-000000000001';
const EMPLOYEE_ID = 'f0000000-0000-4000-8000-000000000002';
const SHIFT_ID = 'f0000000-0000-4000-8000-000000000003';
const JOB_ID = 'f0000000-0000-4000-8000-000000000004';

const EMPLOYEE: Employee = {
  id: EMPLOYEE_ID,
  name: 'Ada',
  skillIds: [SKILL_ID],
  availability: [{ day: 5, startMinute: 480, endMinute: 720 }],
  contractMaxMinutes: 2400,
};
const SHIFT: Shift = {
  id: SHIFT_ID,
  day: 5,
  startMinute: 480,
  endMinute: 720,
  requiredSkillIds: [SKILL_ID],
  headcount: 1,
};

let jobResponse: SolveJob;
let employees: Employee[];
let shifts: Shift[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  employees = [EMPLOYEE];
  shifts = [SHIFT];
  jobResponse = { jobId: JOB_ID, status: 'running' };
  // The Zustand store (and its sessionStorage persistence) survives across
  // tests — reset both so each test starts with no active job.
  sessionStorage.clear();
  useScheduleStore.setState({ activeJobId: null });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/employees')) return jsonResponse(employees);
      if (url.endsWith('/api/shifts')) return jsonResponse(shifts);
      if (url.endsWith('/api/solves') && method === 'POST') {
        return jsonResponse({ jobId: JOB_ID, status: 'queued' }, 201);
      }
      if (url.includes('/api/solves/')) return jsonResponse(jobResponse);
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SchedulePage', () => {
  it('disables the run button while there is no data', async () => {
    employees = [];
    shifts = [];
    renderWithProviders(<SchedulePage />);

    expect(await screen.findByRole('button', { name: /run scheduler/i })).toBeDisabled();
    expect(screen.getByText(/add at least one employee/i)).toBeInTheDocument();
  });

  it('polls the job and renders the calendar with the assignment', async () => {
    // Hand-computed (M3): 240-minute Saturday shift → 240 + 1 fairness = 241.
    jobResponse = {
      jobId: JOB_ID,
      status: 'optimal',
      result: {
        status: 'optimal',
        objectiveValue: 241,
        assignments: [{ employeeId: EMPLOYEE_ID, shiftId: SHIFT_ID }],
      },
    };

    renderWithProviders(<SchedulePage />);
    // Wait for both data queries: the button is disabled until they land.
    const runButton = await screen.findByRole('button', { name: /run scheduler/i });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    // Polling lands on the finished schedule (the instant "queued"
    // acceptance is covered by the api's integration test).
    expect(await screen.findByText("This week's schedule")).toBeInTheDocument();
    expect(screen.getByText('Saturday')).toBeInTheDocument();
    expect(await screen.findByText('08:00–12:00')).toBeInTheDocument();
    expect(screen.getByText(/objective score 241/i)).toBeInTheDocument();
  });

  it('lists every conflict in the infeasible view', async () => {
    jobResponse = {
      jobId: JOB_ID,
      status: 'infeasible',
      message: 'Shift f0…002 (day 5, minutes 480-720) requires 2 eligible employee(s), but only 1 qualify.',
      result: {
        status: 'infeasible',
        conflicts: [
          'Shift f0…002 (day 5, minutes 480-720) requires 2 eligible employee(s), but only 1 qualify.',
        ],
      },
    };

    renderWithProviders(<SchedulePage />);
    const runButton = await screen.findByRole('button', { name: /run scheduler/i });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    expect(await screen.findByText('The rules conflict')).toBeInTheDocument();
    expect(screen.getByText(/requires 2 eligible employee/i)).toBeInTheDocument();
  });

  it('shows the failed state with the job message', async () => {
    jobResponse = {
      jobId: JOB_ID,
      status: 'failed',
      message: 'Optimizer is unreachable at http://127.0.0.1:3002',
    };

    renderWithProviders(<SchedulePage />);
    const runButton = await screen.findByRole('button', { name: /run scheduler/i });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    expect(await screen.findByText('Solve failed')).toBeInTheDocument();
    expect(screen.getByText(/optimizer is unreachable/i)).toBeInTheDocument();
  });

  it('keeps polling in the running state', async () => {
    jobResponse = { jobId: JOB_ID, status: 'running' };
    renderWithProviders(<SchedulePage />);
    const runButton = await screen.findByRole('button', { name: /run scheduler/i });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    expect(await screen.findByText('Solving')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    // Terminal views never appear while polling.
    expect(screen.queryByText("This week's schedule")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Solve failed')).not.toBeInTheDocument());
  });
});
