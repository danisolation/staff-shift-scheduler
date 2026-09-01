import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SkillsModule } from './skills/skills.module';

@Module({
  imports: [
    // Environment variables are validated once, here, by the shared zod
    // schema (see config/env.schema.ts). Everything else in the app reads
    // typed values from ConfigService — never process.env directly.
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    HealthModule,
    SkillsModule,
    EmployeesModule,
    ShiftsModule,
  ],
})
export class AppModule {}
