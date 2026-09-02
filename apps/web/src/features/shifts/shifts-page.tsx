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
        <h1 className="text-3xl font-bold">Shifts</h1>
        <p className="mt-2 text-muted-foreground">
          The time windows that must be staffed during the week.
        </p>
      </header>

      <ShiftForm />

      <Card>
        <CardHeader>
          <CardTitle>Shift List</CardTitle>
          <CardDescription>
            What the scheduler must cover.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shifts.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {shifts.isError && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {shifts.error.message}
            </div>
          )}
          {shifts.data !== undefined && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Time Window</TableHead>
                  <TableHead>Required Skills</TableHead>
                  <TableHead>People Needed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.data.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{dayName(shift.day)}</TableCell>
                    <TableCell>{formatShiftWindow(shift)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {shift.requiredSkillIds.map((skillId) => (
                          <Badge key={skillId} variant="secondary">
                            {skillName(skillId)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{shift.headcount}</TableCell>
                  </TableRow>
                ))}
                {shifts.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground py-8" colSpan={4}>
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
