import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER, RequestIdMiddleware } from './request-id.middleware.js';

function run(incoming?: string) {
  const sent: Record<string, string> = {};
  const req = {
    headers: incoming ? { [REQUEST_ID_HEADER]: incoming } : {},
    header: (name: string) => (incoming && name === REQUEST_ID_HEADER ? incoming : undefined),
  } as unknown as Request;
  const res = {
    setHeader: (name: string, value: string) => {
      sent[name] = value;
    },
  } as unknown as Response;
  const next = vi.fn();
  new RequestIdMiddleware().use(req, res, next as unknown as NextFunction);
  return { req, sent, next };
}

describe('RequestIdMiddleware', () => {
  it('generates a uuid when the client sends none, and shares it with the app', () => {
    const { req, sent, next } = run();
    expect(sent[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.headers[REQUEST_ID_HEADER]).toBe(sent[REQUEST_ID_HEADER]);
    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps a safe incoming id', () => {
    expect(run('trace-42').sent[REQUEST_ID_HEADER]).toBe('trace-42');
  });

  it('replaces an unsafe incoming id', () => {
    expect(run('bad id <script>').sent[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
