import { Prisma } from '@prisma/client';

/**
 * True when `error` is a known Prisma request error with the given code.
 *
 * Prisma reports database-level failures as typed errors with stable codes
 * (P2002 unique constraint, P2003 foreign key violation, P2025 record not
 * found, ...). Repositories match on these codes to translate them into the
 * interface conventions — checking `instanceof` first keeps a rethrown
 * non-Prisma error (or a TypeError in our own code) from being mistaken for
 * one. See docs/DATABASE.md for the codes that matter.
 */
export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
