import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Skill } from '@scheduler/contracts';
import { renderWithProviders } from '@/lib/test-utils';
import { SkillsPage } from './skills-page';

/**
 * The fetch mock routes by URL + method, exactly like the Vite dev proxy
 * would reach the api. State is mutable so the list refetch (triggered by
 * the create mutation's invalidation) sees the created skill.
 */
let skills: Skill[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  skills = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/skills') && (init?.method ?? 'GET') === 'GET') {
        return jsonResponse(skills);
      }
      if (url.endsWith('/api/skills') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        if (skills.some((skill) => skill.name.toLowerCase() === body.name.toLowerCase())) {
          return jsonResponse({ statusCode: 409, message: 'A skill named "X" already exists' }, 409);
        }
        const created: Skill = { id: crypto.randomUUID(), name: body.name };
        skills = [...skills, created];
        return jsonResponse(created, 201);
      }
      throw new Error(`Unexpected fetch: ${String(init?.method ?? 'GET')} ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SkillsPage', () => {
  it('renders the skill list from the api', async () => {
    skills = [{ id: crypto.randomUUID(), name: 'Barista' }];
    renderWithProviders(<SkillsPage />);

    expect(await screen.findByText('Barista')).toBeInTheDocument();
  });

  it('shows a validation error and sends nothing on an empty name', async () => {
    renderWithProviders(<SkillsPage />);

    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('creates a skill and the list refetches to include it', async () => {
    renderWithProviders(<SkillsPage />);

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Latte Art' } });
    fireEvent.click(screen.getByRole('button', { name: /add skill/i }));

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
    });
    expect(await screen.findByText('Latte Art')).toBeInTheDocument();
  });
});
