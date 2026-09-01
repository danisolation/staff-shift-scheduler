import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { shiftCreateSchema, type ShiftCreateInput } from '@scheduler/contracts';
import { dayName, parseMinutesOfDay } from '@/lib/time';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { useCreateShift } from './use-shifts';
import { useSkills } from '../skills/use-skills';

/**
 * Same pattern as the employee form: local schema with "HH:MM" strings for
 * the time inputs, converted to domain minutes on submit and re-validated
 * against the shared contract before leaving the page.
 */
const shiftFormSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.string(),
    end: z.string(),
    requiredSkillIds: z.array(z.string()).min(1, 'Pick at least one required skill'),
    headcount: z.coerce.number().int().min(1, 'Headcount must be at least 1'),
  })
  .refine((values) => values.start < values.end, {
    message: 'End time must be after start time',
    path: ['start'],
  });

type ShiftFormValues = z.infer<typeof shiftFormSchema>;

const DEFAULT_VALUES: ShiftFormValues = {
  day: 0,
  start: '09:00',
  end: '17:00',
  requiredSkillIds: [],
  headcount: 1,
};

export function ShiftForm() {
  const createShift = useCreateShift();
  const skills = useSkills();

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: { ...DEFAULT_VALUES },
  });

  const onSubmit = handleSubmit((values) => {
    const input: ShiftCreateInput = shiftCreateSchema.parse({
      day: values.day,
      startMinute: parseMinutesOfDay(values.start),
      endMinute: parseMinutesOfDay(values.end),
      requiredSkillIds: values.requiredSkillIds,
      headcount: values.headcount,
    });
    createShift.mutate(input, { onSuccess: () => reset({ ...DEFAULT_VALUES }) });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a shift</CardTitle>
        <CardDescription>
          A shift is a time window on one day that needs employees holding every required skill.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-6" noValidate>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="shift-day">Day</Label>
              <Controller
                control={control}
                name="day"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id="shift-day" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {dayName(day)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-start">From</Label>
              <Input id="shift-start" type="time" {...register('start')} />
              {errors.start !== undefined && (
                <p role="alert" className="text-destructive text-sm">{errors.start.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-end">Until</Label>
              <Input id="shift-end" type="time" {...register('end')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-headcount">People needed</Label>
              <Input id="shift-headcount" type="number" min={1} {...register('headcount')} />
              {errors.headcount !== undefined && (
                <p role="alert" className="text-destructive text-sm">{errors.headcount.message}</p>
              )}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Required skills</legend>
            {skills.isPending && <p className="text-muted-foreground text-sm">Loading skills…</p>}
            {skills.isError && <p role="alert" className="text-destructive text-sm">{skills.error.message}</p>}
            {skills.data !== undefined && skills.data.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {skills.data.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" value={skill.id} {...register('requiredSkillIds')} className="size-4" />
                    {skill.name}
                  </label>
                ))}
              </div>
            )}
            {skills.data !== undefined && skills.data.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No skills yet — create some on the Skills page first.
              </p>
            )}
            {errors.requiredSkillIds !== undefined && (
              <p role="alert" className="text-destructive text-sm">{errors.requiredSkillIds.message}</p>
            )}
          </fieldset>

          <Button type="submit" disabled={createShift.isPending}>
            {createShift.isPending ? 'Adding…' : 'Add shift'}
          </Button>
          {createShift.isError && (
            <p role="alert" className="text-destructive text-sm">{createShift.error.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
