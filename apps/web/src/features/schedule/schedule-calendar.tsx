import type { Employee, Shift, SolveAssignment } from '@scheduler/contracts';
import { dayName, formatShiftWindow } from '@/lib/time';
import { Badge } from '@/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/table';

const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

interface ScheduleCalendarProps {
  employees: Employee[];
  shifts: Shift[];
  assignments: SolveAssignment[];
}

/**
 * The weekly schedule: one row per employee, one column per day, a chip per
 * assigned shift. A pure view over the solver's assignments — no formatting
 * outside lib/time.ts, no date math (the week is the domain's day indices).
 */
export function ScheduleCalendar({ employees, shifts, assignments }: ScheduleCalendarProps) {
  const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));

  // assignments → "employeeId|day" → shifts, so each cell renders its own
  // chips without scanning the whole list per cell.
  const shiftsByEmployeeAndDay = new Map<string, Shift[]>();
  for (const assignment of assignments) {
    const shift = shiftsById.get(assignment.shiftId);
    // Skip defensively: an employee or shift may have been deleted after
    // this solve ran; the rest of the schedule still renders.
    if (shift === undefined) continue;
    const key = `${assignment.employeeId}|${shift.day}`;
    const dayShifts = shiftsByEmployeeAndDay.get(key) ?? [];
    dayShifts.push(shift);
    shiftsByEmployeeAndDay.set(key, dayShifts);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          {DAY_INDICES.map((day) => (
            <TableHead key={day} className="text-center">
              {dayName(day)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className="font-medium">{employee.name}</TableCell>
            {DAY_INDICES.map((day) => {
              const dayShifts =
                shiftsByEmployeeAndDay.get(`${employee.id}|${day}`) ?? [];
              return (
                <TableCell key={day} className="align-top">
                  {dayShifts.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dayShifts.map((shift) => (
                        <Badge key={shift.id} variant="outline">
                          {formatShiftWindow(shift)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
