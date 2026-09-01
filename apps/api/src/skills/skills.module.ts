import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SKILL_REPOSITORY } from './skill.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaSkillRepository } from '../prisma/prisma-skill.repository';

/**
 * Wires the three layers together. The provider maps the repository token
 * to its implementation — this line used to say InMemorySkillRepository;
 * the PostgreSQL swap changed exactly this line (plus the PrismaModule
 * import), and no controller or service changed at all.
 */
@Module({
  imports: [PrismaModule],
  controllers: [SkillsController],
  providers: [SkillsService, { provide: SKILL_REPOSITORY, useClass: PrismaSkillRepository }],
  // Exported so other modules (Employees, Shifts) can inject the repository
  // to enforce referential integrity — an export is required for anything
  // a consuming module wants to inject; NestJS shares nothing by default.
  exports: [SkillsService, SKILL_REPOSITORY],
})
export class SkillsModule {}
