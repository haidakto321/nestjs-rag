import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'socket.io';

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'message' in value) {
    const { message } = value as { message: unknown };
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return 'Request failed';
}

/** The message a client may see, or undefined for unexpected errors (those stay in the log). */
export function clientMessage(exception: unknown): string | undefined {
  if (exception instanceof WsException) return textOf(exception.getError());
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status < 500 || status === 503) return textOf(exception.getResponse());
  }
  return undefined;
}

// Socket-side twin of AppExceptionFilter: filters are per transport, so gateways need their own.
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const message = clientMessage(exception);
    if (message !== undefined) {
      client.emit('error', { message });
      return;
    }
    const requestId = randomUUID();
    this.logger.error(`Socket handler failed id=${requestId}`, exception instanceof Error ? exception.stack : String(exception));
    client.emit('error', { message: 'Internal error', requestId });
  }
}
