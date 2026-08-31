import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SkillsModule } from './skills/skills.module';

@Module({
  imports: [HealthModule, SkillsModule, EmployeesModule, ShiftsModule],
})
export class AppModule {}
