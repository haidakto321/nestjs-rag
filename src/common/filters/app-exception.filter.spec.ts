import { ConflictException, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { AppExceptionFilter, toHttpException } from './app-exception.filter.js';

const pgError = (code: string, constraint?: string) => Object.assign(new Error('db error'), { code, constraint });

describe('toHttpException', () => {
  it('maps a unique violation on a known constraint to a friendly 409', () => {
    const result = toHttpException(new QueryFailedError('INSERT', [], pgError('23505', 'users_email_key')));
    expect(result).toBeInstanceOf(ConflictException);
    expect((result as ConflictException).message).toBe('Email is already registered');
  });

  it('maps an unknown unique violation to a generic 409', () => {
    const result = toHttpException(new QueryFailedError('INSERT', [], pgError('23505', 'other_key')));
    expect((result as ConflictException).message).toBe('Resource already exists');
  });

  it('maps EntityNotFoundError to 404', () => {
    expect(toHttpException(new EntityNotFoundError('User', { id: 'x' }))).toBeInstanceOf(NotFoundException);
  });

  it('leaves other database errors alone, so they become a 500', () => {
    const error = new QueryFailedError('SELECT', [], pgError('42P01'));
    expect(toHttpException(error)).toBe(error);
  });
});

describe('AppExceptionFilter', () => {
  it('answers an unexpected error with 500 and the request id, never the stack', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-request-id': 'req-1' } }),
        getResponse: () => ({ headersSent: false, status }),
      }),
    } as unknown as ArgumentsHost;
    new AppExceptionFilter().catch(new Error('boom at line 42'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal error', requestId: 'req-1' });
  });
});
