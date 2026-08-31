import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorResponse } from '@scheduler/contracts';

/**
 * Global exception filter: every thrown error becomes the same JSON shape —
 * { statusCode, message, details } — the envelope contracted in
 * `packages/contracts`. Consistency here is the backend equivalent of a
 * design system: clients can always rely on the error shape, so their
 * error handling is written once.
 *
 * NestJS calls this for any error that escapes a controller:
 * - HttpException (and subclasses like BadRequestException, NotFoundException)
 *   carries a status code we honor.
 * - Anything else is an unexpected crash — logged with the stack, but the
 *   client still gets a clean 500 envelope, never raw internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      // NestJS exceptions carry either a plain string or a structured body.
      if (typeof body === 'string') {
        message = body;
      } else {
        const structured = body as { message?: string; details?: unknown };
        message = structured.message ?? exception.message;
        details = structured.details ?? exception.cause;
      }
    } else {
      // Unexpected error: log everything, reveal nothing.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const envelope: ErrorResponse = { statusCode, message, details };
    response.status(statusCode).json(envelope);
  }
}
