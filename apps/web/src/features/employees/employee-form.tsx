import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { employeeCreateSchema, type EmployeeCreateInput } from '@scheduler/contracts';
import { parseMinutesOfDay } from '@/lib/time';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { dayName } from '@/lib/time';
import { useCreateEmployee } from './use-employees';
import { useSkills } from '../skills/use-skills';

/**
 * The form's own schema: identical rules to the shared employeeCreateSchema,
 * except availability times are "HH:MM" strings — what `<input type="time">`
 * produces. On submit they are converted to domain minutes and re-validated
 * against the contract (parse below), so the shared schema stays the
 * boundary even though the form speaks time-strings.
 */
const availabilityWindowFormSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string(),
  end: z.string(),
});

const employeeFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    skillIds: z.array(z.string()).min(1, 'Pick at least one skill'),
    availability: z.array(availabilityWindowFormSchema).min(1, 'Add at least one availability window'),
    contractMaxHours: z.coerce.number().int().min(1, 'Weekly cap must be at least 1 hour'),
  })
  .refine(
    (values) => values.availability.every((window) => window.start < window.end),
    { message: 'End time must be after start time', path: ['availability'] },
  );

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

const DEFAULT_WINDOW = { day: 0, start: '09:00', end: '17:00' } as const;

export function EmployeeForm() {
  const createEmployee = useCreateEmployee();
  const skills = useSkills();

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { name: '', skillIds: [], availability: [{ ...DEFAULT_WINDOW }], contractMaxHours: 40 },
  });
  const availabilityArray = useFieldArray({ control, name: 'availability' });

  const onSubmit = handleSubmit((values) => {
    const input: EmployeeCreateInput = employeeCreateSchema.parse({
      name: values.name,
      skillIds: values.skillIds,
      availability: values.availability.map((window) => ({
        day: window.day,
        startMinute: parseMinutesOfDay(window.start),
        endMinute: parseMinutesOfDay(window.end),
      })),
      // Hours in the UI, minutes in the domain.
      contractMaxMinutes: values.contractMaxHours * 60,
    });
    createEmployee.mutate(input, {
      onSuccess: () =>
        reset({ name: '', skillIds: [], availability: [{ ...DEFAULT_WINDOW }], contractMaxHours: 40 }),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an employee</CardTitle>
        <CardDescription>
          Employees hold skills and declare when they are available during the week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-6"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="employee-name">Name</Label>
            <Input id="employee-name" placeholder="Ada" {...register('name')} />
            {errors.name !== undefined && (
              <p role="alert" className="text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Skills</legend>
            {skills.isPending && <p className="text-muted-foreground text-sm">Loading skills…</p>}
            {skills.isError && <p role="alert" className="text-destructive text-sm">{skills.error.message}</p>}
            {skills.data !== undefined && skills.data.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {skills.data.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" value={skill.id} {...register('skillIds')} className="size-4" />
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
            {errors.skillIds !== undefined && (
              <p role="alert" className="text-destructive text-sm">{errors.skillIds.message}</p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Availability</legend>
            {availabilityArray.fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`availability-${index}-day`}>Day</Label>
                  <Controller
                    control={control}
                    name={`availability.${index}.day` as const}
                    render={({ field: dayField }) => (
                      <Select
                        value={String(dayField.value)}
                        onValueChange={(value) => dayField.onChange(Number(value))}
                      >
                        <SelectTrigger id={`availability-${index}-day`} className="w-32">
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
                  <Label htmlFor={`availability-${index}-start`}>From</Label>
                  <Input
                    id={`availability-${index}-start`}
                    type="time"
                    {...register(`availability.${index}.start` as const)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`availability-${index}-end`}>Until</Label>
                  <Input
                    id={`availability-${index}-end`}
                    type="time"
                    {...register(`availability.${index}.end` as const)}
                  />
                </div>
                {availabilityArray.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remove window ${index + 1}`}
                    onClick={() => availabilityArray.remove(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => availabilityArray.append({ ...DEFAULT_WINDOW })}>
              Add window
            </Button>
            {errors.availability !== undefined && (
              <p role="alert" className="text-destructive text-sm">{errors.availability.message ?? errors.availability.root?.message}</p>
            )}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="employee-contract-max">Max hours / week</Label>
            <Input
              id="employee-contract-max"
              type="number"
              min={1}
              placeholder="40"
              {...register('contractMaxHours')}
            />
            {errors.contractMaxHours !== undefined && (
              <p role="alert" className="text-destructive text-sm">{errors.contractMaxHours.message}</p>
            )}
          </div>

          <Button type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending ? 'Adding…' : 'Add employee'}
          </Button>
          {createEmployee.isError && (
            <p role="alert" className="text-destructive text-sm">{createEmployee.error.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
