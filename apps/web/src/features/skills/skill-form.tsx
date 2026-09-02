import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { skillCreateSchema, type SkillCreateInput } from '@scheduler/contracts';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { useCreateSkill } from './use-skills';

/**
 * Create-skill form. Validation comes from the shared contract schema
 * (zodResolver) — the exact same shape the api validates on its side, so
 * the two can never disagree.
 */
export function SkillForm() {
  const createSkill = useCreateSkill();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SkillCreateInput>({
    resolver: zodResolver(skillCreateSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = handleSubmit((values) => {
    createSkill.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a Skill</CardTitle>
        <CardDescription>
          Skills are the capabilities employees can hold and shifts can require.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="skill-name">Skill Name</Label>
            <Input
              id="skill-name"
              placeholder="e.g., Barista, Cashier, Chef"
              {...register('name')}
            />
            {errors.name !== undefined && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={createSkill.isPending}>
            {createSkill.isPending ? 'Adding...' : 'Add Skill'}
          </Button>
        </form>
        {createSkill.isError && (
          <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {createSkill.error.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
