import {
  Catch,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

export const CONSTRAINT_MESSAGES: Record<string, string> = {
  users_email_key: 'Email is already registered',
  documents_owner_filename_key: 'You already have a document with this filename',
};

export function toHttpException(error: QueryFailedError | EntityNotFoundError): unknown {
  if (error instanceof EntityNotFoundError) return new NotFoundException('Resource not found');
  const driverError = error.driverError as { code?: string; constraint?: string } | undefined;
  if (driverError?.code === '23505') {
    return new ConflictException(CONSTRAINT_MESSAGES[driverError.constraint ?? ''] ?? 'Resource already exists');
  }
  return error;
}

// The single global HTTP filter: DB errors become HTTP errors, HttpExceptions keep Nest's
// default body, and anything unexpected becomes a 500 that carries the request id only.
@Catch()
export class AppExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Global filters never reach gateways (Nest builds their filter context without global ones),
      // so a gateway without @UseFilters gets Nest's built-in `exception` event, not this line.
      // The check stays only as a guard in case another transport is added later.
      this.logger.error('Non-HTTP error reached the HTTP filter', exception instanceof Error ? exception.stack : String(exception));
      return;
    }
    const mapped =
      exception instanceof QueryFailedError || exception instanceof EntityNotFoundError
        ? toHttpException(exception)
        : exception;
    if (mapped instanceof HttpException) {
      super.catch(mapped, host);
      return;
    }
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = String(req.headers['x-request-id'] ?? '');
    this.logger.error(`Unhandled error id=${requestId}`, mapped instanceof Error ? mapped.stack : String(mapped));
    if (!res.headersSent) {
      res.status(500).json({ statusCode: 500, message: 'Internal error', requestId });
    }
  }
}
