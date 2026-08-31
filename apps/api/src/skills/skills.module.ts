import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { InMemorySkillRepository, SKILL_REPOSITORY } from './skill.repository';

/**
 * Wires the three layers together. The provider maps the repository token
 * to its in-memory implementation — Milestone 2 changes exactly this one
 * line to switch to PostgreSQL, nothing else.
 */
@Module({
  controllers: [SkillsController],
  providers: [
    SkillsService,
    { provide: SKILL_REPOSITORY, useClass: InMemorySkillRepository },
  ],
  // Exported so other modules (Employees, Shifts) can inject the repository
  // to enforce referential integrity — an export is required for anything
  // a consuming module wants to inject; NestJS shares nothing by default.
  exports: [SkillsService, SKILL_REPOSITORY],
})
export class SkillsModule {}
