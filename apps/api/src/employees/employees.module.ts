import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EMPLOYEE_REPOSITORY } from './employee.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaEmployeeRepository } from '../prisma/prisma-employee.repository';

/**
 * Employees depend on skills (an employee references skill ids), so this
 * module imports SkillsModule — NestJS makes its exported providers
 * injectable here. That cross-module wiring is how features compose in
 * Nest: each module owns its data, others consume it through exports.
 * PrismaModule supplies the shared database client to the repository.
 */
@Module({
  imports: [SkillsModule, PrismaModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository }],
  exports: [EmployeesService],
})
export class EmployeesModule {}
