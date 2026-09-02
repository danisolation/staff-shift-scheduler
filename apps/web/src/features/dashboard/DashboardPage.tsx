import { Link } from 'react-router';
import { useSkills } from '../skills/use-skills';
import { useEmployees } from '../employees/use-employees';
import { useShifts } from '../shifts/use-shifts';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';

export function DashboardPage() {
  const { user } = useAuth();
  const skills = useSkills();
  const employees = useEmployees();
  const shifts = useShifts();

  const stats = [
    {
      label: 'Skills',
      value: skills.data?.length ?? 0,
      loading: skills.isPending,
      link: '/skills',
      description: 'Capabilities your staff has',
    },
    {
      label: 'Employees',
      value: employees.data?.length ?? 0,
      loading: employees.isPending,
      link: '/employees',
      description: 'Workers to assign to shifts',
    },
    {
      label: 'Shifts',
      value: shifts.data?.length ?? 0,
      loading: shifts.isPending,
      link: '/shifts',
      description: 'Time slots that need coverage',
    },
  ];

  const hasData = (skills.data?.length ?? 0) > 0 &&
                  (employees.data?.length ?? 0) > 0 &&
                  (shifts.data?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.name ?? 'there'}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your staff schedule with intelligent optimization.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{stat.value}</div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Getting started guide */}
      {!hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to create your first schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Create Skills</h3>
                  <p className="text-sm text-muted-foreground">
                    Define the capabilities your staff has (e.g., "Barista", "Cashier", "Chef").
                  </p>
                  <Link to="/skills">
                    <Button variant="link" className="mt-1 h-auto p-0">
                      Go to Skills →
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Add Employees</h3>
                  <p className="text-sm text-muted-foreground">
                    Add your workers with their skills, availability, and max hours.
                  </p>
                  <Link to="/employees">
                    <Button variant="link" className="mt-1 h-auto p-0">
                      Go to Employees →
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Define Shifts</h3>
                  <p className="text-sm text-muted-foreground">
                    Create the shifts that need coverage with required skills and headcount.
                  </p>
                  <Link to="/shifts">
                    <Button variant="link" className="mt-1 h-auto p-0">
                      Go to Shifts →
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold">Run the Scheduler</h3>
                  <p className="text-sm text-muted-foreground">
                    Let the optimizer find the best assignment of employees to shifts.
                  </p>
                  <Link to="/schedule">
                    <Button variant="link" className="mt-1 h-auto p-0">
                      Go to Schedule →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions when data exists */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              What would you like to do?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/schedule">
                <Button>Run Scheduler</Button>
              </Link>
              <Link to="/skills">
                <Button variant="outline">Manage Skills</Button>
              </Link>
              <Link to="/employees">
                <Button variant="outline">Manage Employees</Button>
              </Link>
              <Link to="/shifts">
                <Button variant="outline">Manage Shifts</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
