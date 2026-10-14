import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { TimingInterceptor } from './timing.interceptor.js';

function httpContext(res: { headersSent: boolean; setHeader: ReturnType<typeof vi.fn> }) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', originalUrl: '/x', headers: { 'x-request-id': 'r1' } }),
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('TimingInterceptor', () => {
  it('sets X-Response-Time and passes the handler value through', async () => {
    const res = { headersSent: false, setHeader: vi.fn() };
    const handler: CallHandler = { handle: () => of('body') };
    const value = await lastValueFrom(new TimingInterceptor().intercept(httpContext(res), handler));
    expect(value).toBe('body');
    expect(res.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/^\d+\.\dms$/));
  });

  it('leaves headers alone once they are sent', async () => {
    const res = { headersSent: true, setHeader: vi.fn() };
    await lastValueFrom(new TimingInterceptor().intercept(httpContext(res), { handle: () => of(null) }));
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('does nothing for non-HTTP contexts', async () => {
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;
    const value = await lastValueFrom(new TimingInterceptor().intercept(context, { handle: () => of(1) }));
    expect(value).toBe(1);
  });
});
