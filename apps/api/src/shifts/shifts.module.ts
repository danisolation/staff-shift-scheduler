import { Module } from '@nestjs/common';
import { SkillsModule } from '../skills/skills.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { InMemoryShiftRepository, SHIFT_REPOSITORY } from './shift.repository';

/** Shifts reference skills, so this module imports SkillsModule. */
@Module({
  imports: [SkillsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService, { provide: SHIFT_REPOSITORY, useClass: InMemoryShiftRepository }],
  exports: [ShiftsService],
})
export class ShiftsModule {}
