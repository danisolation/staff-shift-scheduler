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
import { dayName, formatShiftWindow } from '@/lib/time';
import { ShiftForm } from './shift-form';
import { useShifts } from './use-shifts';
import { useSkills } from '../skills/use-skills';

export function ShiftsPage() {
  const shifts = useShifts();
  const skills = useSkills();

  const skillName = (skillId: string): string =>
    skills.data?.find((skill) => skill.id === skillId)?.name ?? 'unknown skill';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <p className="text-muted-foreground">
          The time windows that must be staffed during the week.
        </p>
      </header>

      <ShiftForm />

      <Card>
        <CardHeader>
          <CardTitle>Shifts</CardTitle>
          <CardDescription>What the scheduler must cover.</CardDescription>
        </CardHeader>
        <CardContent>
          {shifts.isPending && (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          )}
          {shifts.isError && <p role="alert" className="text-destructive text-sm">{shifts.error.message}</p>}
          {shifts.data !== undefined && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Required skills</TableHead>
                  <TableHead>People needed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.data.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{dayName(shift.day)}</TableCell>
                    <TableCell>{formatShiftWindow(shift)}</TableCell>
                    <TableCell>{shift.requiredSkillIds.map(skillName).join(', ')}</TableCell>
                    <TableCell>{shift.headcount}</TableCell>
                  </TableRow>
                ))}
                {shifts.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>
                      No shifts yet — add the first one above.
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
