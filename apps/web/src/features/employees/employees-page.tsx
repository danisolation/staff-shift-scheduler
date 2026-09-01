import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/table';
import { dayName, formatMinutesAsWeeklyHours, formatShiftWindow } from '@/lib/time';
import { EmployeeForm } from './employee-form';
import { useEmployees } from './use-employees';
import { useSkills } from '../skills/use-skills';

export function EmployeesPage() {
  const employees = useEmployees();
  const skills = useSkills();

  const skillName = (skillId: string): string =>
    skills.data?.find((skill) => skill.id === skillId)?.name ?? 'unknown skill';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="text-muted-foreground">
          Who can work, what they can do, and when they are available.
        </p>
      </header>

      <EmployeeForm />

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Everyone the scheduler can assign to shifts.</CardDescription>
        </CardHeader>
        <CardContent>
          {employees.isPending && (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          )}
          {employees.isError && (
            <p role="alert" className="text-destructive text-sm">{employees.error.message}</p>
          )}
          {employees.data !== undefined && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Max / week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.data.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.skillIds.map(skillName).join(', ')}</TableCell>
                    <TableCell>
                      {employee.availability
                        .map(
                          (window) =>
                            `${dayName(window.day)} ${formatShiftWindow(window)}`,
                        )
                        .join(', ')}
                    </TableCell>
                    <TableCell>{formatMinutesAsWeeklyHours(employee.contractMaxMinutes)}</TableCell>
                  </TableRow>
                ))}
                {employees.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>
                      No employees yet — add the first one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
