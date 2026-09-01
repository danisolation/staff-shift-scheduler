import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { PrismaModule } from '../prisma/prisma.module';
import { HttpOptimizerClient, OPTIMIZER_BASE_URL, OPTIMIZER_CLIENT } from './optimizer-client';
import { SolvesController } from './solves.controller';
import { SolvesService } from './solves.service';

/**
 * Wires the async solve job feature: controller (HTTP) → service (job
 * lifecycle) → optimizer client (the typed boundary to the model server).
 *
 * The base URL comes from the validated environment (OPTIMIZER_BASE_URL).
 * Standalone test compilations override the OPTIMIZER_BASE_URL provider
 * directly — that is why the factory is isolated in its own provider.
 */
@Module({
  imports: [PrismaModule],
  controllers: [SolvesController],
  providers: [
    SolvesService,
    { provide: OPTIMIZER_CLIENT, useClass: HttpOptimizerClient },
    {
      provide: OPTIMIZER_BASE_URL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) =>
        configService.getOrThrow('OPTIMIZER_BASE_URL', { infer: true }),
    },
  ],
  // Exported so integration tests (and a future queue worker module) can
  // drive real jobs against the real optimizer client.
  exports: [SolvesService],
})
export class SolvesModule {}
