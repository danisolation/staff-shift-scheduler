import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Provides the shared PrismaClient (PrismaService) to whoever imports it.
 *
 * Deliberately NOT decorated with @Global: each feature module imports
 * PrismaModule explicitly, so every module stays self-contained — compiling
 * `Test.createTestingModule({ imports: [SkillsModule] })` works without the
 * whole AppModule. That property is what module-wiring.spec.ts relies on.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
