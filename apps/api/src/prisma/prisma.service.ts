import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The one database connection the whole api shares. Extending PrismaClient
 * makes this class both the injectable NestJS service and the actual client:
 * repositories receive it via constructor injection and call `prisma.skill...`
 * on it directly.
 *
 * Two lifecycle choices worth understanding:
 *
 * - **Lazy connect.** There is deliberately no `onModuleInit` calling
 *   `$connect()`. Prisma opens the real connection on the first query, so a
 *   module that is merely *compiled* (like the module-wiring test, or a boot
 *   with the database briefly down) never touches Postgres. Eagerly
 *   connecting would couple "the app can start" to "the database is up".
 * - **Disconnect on shutdown.** With `app.enableShutdownHooks()` in main.ts,
 *   NestJS calls `onModuleDestroy` on SIGINT/SIGTERM and we close the
 *   connection pool cleanly instead of letting the process die holding
 *   sockets.
 *
 * The connection string itself is not passed here: PrismaClient reads
 * `DATABASE_URL` from the environment, which the ConfigModule has already
 * validated at boot (see config/env.schema.ts).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
