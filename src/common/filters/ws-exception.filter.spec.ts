import { BadRequestException, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { clientMessage } from './ws-exception.filter.js';

describe('clientMessage', () => {
  it('passes WsException text through', () => {
    expect(clientMessage(new WsException('busy'))).toBe('busy');
  });

  it('joins validation messages from a 400', () => {
    expect(clientMessage(new BadRequestException(['question is too short', 'mode is invalid']))).toBe(
      'question is too short; mode is invalid',
    );
  });

  it('shows a 503, because the client can act on it', () => {
    expect(clientMessage(new ServiceUnavailableException('Embedding service unavailable'))).toBe(
      'Embedding service unavailable',
    );
  });

  it('hides unexpected errors and 500s', () => {
    expect(clientMessage(new Error('db password is hunter2'))).toBeUndefined();
    expect(clientMessage(new InternalServerErrorException('stack details'))).toBeUndefined();
  });
});
