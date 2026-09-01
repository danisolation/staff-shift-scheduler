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
        <h1 className="text-2xl font-semibold">Skills</h1>
        <p className="text-muted-foreground">
          Define the capabilities your staff has and your shifts need.
        </p>
      </header>

      <SkillForm />

      <Card>
        <CardHeader>
          <CardTitle>Existing skills</CardTitle>
          <CardDescription>Employees can hold any of these; shifts can require them.</CardDescription>
        </CardHeader>
        <CardContent>
          {skills.isPending && (
            <div className="space-y-2" aria-busy>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          )}
          {skills.isError && <p role="alert" className="text-destructive text-sm">{skills.error.message}</p>}
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
                    <TableCell>{skill.name}</TableCell>
                  </TableRow>
                ))}
                {skills.data.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">No skills yet — add the first one above.</TableCell>
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
