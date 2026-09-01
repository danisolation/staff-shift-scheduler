import { Routes, Route, Link, NavLink } from 'react-router';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SkillsPage } from './features/skills/skills-page';
import { EmployeesPage } from './features/employees/employees-page';
import { ShiftsPage } from './features/shifts/shifts-page';
import { SchedulePage } from './features/schedule/schedule-page';
import { cn } from '@/lib/utils';

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/skills', label: 'Skills' },
  { to: '/employees', label: 'Employees' },
  { to: '/shifts', label: 'Shifts' },
  { to: '/schedule', label: 'Schedule' },
];

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="text-lg font-semibold">
            Staff Shift Scheduler
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
        </Routes>
      </main>
    </div>
  );
}
