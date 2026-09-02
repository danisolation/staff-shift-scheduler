import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { Badge } from '@/ui/badge';
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
        <h1 className="text-3xl font-bold">Employees</h1>
        <p className="mt-2 text-muted-foreground">
          Who can work, what they can do, and when they are available.
        </p>
      </header>

      <EmployeeForm />

      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
          <CardDescription>
            Everyone the scheduler can assign to shifts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {employees.isError && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {employees.error.message}
            </div>
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
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {employee.skillIds.map((skillId) => (
                          <Badge key={skillId} variant="secondary">
                            {skillName(skillId)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {employee.availability.map((window, i) => (
                          <Badge key={i} variant="outline">
                            {dayName(window.day)} {formatShiftWindow(window)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMinutesAsWeeklyHours(employee.contractMaxMinutes)}
                    </TableCell>
                  </TableRow>
                ))}
                {employees.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground py-8" colSpan={4}>
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
