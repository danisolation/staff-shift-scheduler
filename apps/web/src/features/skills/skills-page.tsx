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
import { SkillForm } from './skill-form';
import { useSkills } from './use-skills';

export function SkillsPage() {
  const skills = useSkills();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Skills</h1>
        <p className="mt-2 text-muted-foreground">
          Define the capabilities your staff has and your shifts need.
        </p>
      </header>

      <SkillForm />

      <Card>
        <CardHeader>
          <CardTitle>Existing Skills</CardTitle>
          <CardDescription>
            Employees can hold any of these; shifts can require them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skills.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {skills.isError && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {skills.error.message}
            </div>
          )}
          {skills.data !== undefined && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.data.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                  </TableRow>
                ))}
                {skills.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground py-8">
                      No skills yet — add the first one above.
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
