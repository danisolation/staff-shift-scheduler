import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

// Keep CI logs clean: the 500-path test throws on purpose, and the filter's
// logger would print the fake stack trace — silence it for the whole suite.
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

/** Minimal fake of Nest's execution context, enough to capture the response. */
function createHost(): { host: ArgumentsHost; captured: { status: number; body: unknown } } {
  const captured = { status: HttpStatus.OK, body: undefined as unknown };
  const response = {
    status(code: number) {
      captured.status = code;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as unknown as Response;
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  return { host, captured };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps an HttpException to the contracted envelope', () => {
    const { host, captured } = createHost();
    filter.catch(new BadRequestException('nope'), host);
    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({ statusCode: 400, message: 'nope', details: undefined });
  });

  it('keeps structured details from the exception body', () => {
    const { host, captured } = createHost();
    filter.catch(
      new HttpException({ message: 'Validation failed', details: ['bad'] }, 400),
      host,
    );
    expect(captured.status).toBe(400);
    expect(captured.body).toEqual({
      statusCode: 400,
      message: 'Validation failed',
      details: ['bad'],
    });
  });

  it('hides internal errors behind a clean 500', () => {
    const { host, captured } = createHost();
    filter.catch(new Error('secret stack trace'), host);
    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      details: undefined,
    });
  });
});
