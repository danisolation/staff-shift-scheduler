import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaShiftRepository } from '../prisma/prisma-shift.repository';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { SHIFT_REPOSITORY } from './shift.repository';

/** Shifts reference skills, so this module imports SkillsModule. */
@Module({
  imports: [SkillsModule, PrismaModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, { provide: SHIFT_REPOSITORY, useClass: PrismaShiftRepository }],
  exports: [ShiftsService],
})
export class ShiftsModule {}
