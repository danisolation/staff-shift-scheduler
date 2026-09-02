import { Routes, Route, Link, NavLink, Navigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SkillsPage } from './features/skills/skills-page';
import { EmployeesPage } from './features/employees/employees-page';
import { ShiftsPage } from './features/shifts/shifts-page';
import { SchedulePage } from './features/schedule/schedule-page';
import { LoginPage } from './features/auth/login-page';
import { RegisterPage } from './features/auth/register-page';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/skills', label: 'Skills' },
  { to: '/employees', label: 'Employees' },
  { to: '/shifts', label: 'Shifts' },
  { to: '/schedule', label: 'Schedule' },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="text-lg font-semibold">
            Staff Shift Scheduler
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            {isAuthenticated && NAV_ITEMS.map((item) => (
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
            {isAuthenticated ? (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground">
                  {user?.name}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <NavLink to="/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </NavLink>
                <NavLink to="/register">
                  <Button size="sm">Sign up</Button>
                </NavLink>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/skills" element={
            <ProtectedRoute>
              <SkillsPage />
            </ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>
          } />
          <Route path="/shifts" element={
            <ProtectedRoute>
              <ShiftsPage />
            </ProtectedRoute>
          } />
          <Route path="/schedule" element={
            <ProtectedRoute>
              <SchedulePage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}
