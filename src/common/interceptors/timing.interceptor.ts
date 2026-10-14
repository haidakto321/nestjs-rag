import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

const elapsed = (start: number) => (performance.now() - start).toFixed(1);

// Wraps the handler (after guards and pipes) and reports its time in a header and a log line.
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = performance.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = elapsed(started);
          if (!res.headersSent) res.setHeader('X-Response-Time', `${ms}ms`);
          this.logger.log(`${req.method} ${req.originalUrl} ${ms}ms id=${String(req.headers['x-request-id'])}`);
        },
        error: (error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(`${req.method} ${req.originalUrl} failed after ${elapsed(started)}ms: ${reason}`);
        },
      }),
    );
  }
}
