import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { ValidationError } from 'class-validator';
// Type-only on purpose: a value import would put the Socket class into decorator metadata, and the
// global ValidationPipe (transform: true) would then try to rebuild the socket as if it were a DTO.
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser, JwtPayload } from '../auth/auth-user.js';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter.js';
import { ChatService } from './chat.service.js';
import { AskDto } from './dto/ask.dto.js';

const flatten = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [...Object.values(error.constraints ?? {}), ...flatten(error.children ?? [])]);

const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => new WsException(flatten(errors).join('; ') || 'Invalid payload'),
});

@UseFilters(WsExceptionFilter)
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: 'chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly running = new Map<string, AbortController>();

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
  ) {}

  /** Generations in flight. Tests use it to prove nothing leaks after a disconnect. */
  get activeGenerations(): number {
    return this.running.size;
  }

  // socket.io middleware runs during the handshake, before the connection exists, so a bad token
  // never connects (the client gets connect_error). HTTP guards never run here.
  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      try {
        socket.data.user = this.authenticate(socket.handshake.auth?.token);
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  // Only aborts: the finally in ask() removes the entry once the loop has really ended, so
  // activeGenerations never reports a generation as gone while it still runs.
  handleDisconnect(client: Socket): void {
    this.running.get(client.id)?.abort();
  }

  @SubscribeMessage('ask')
  async ask(@ConnectedSocket() client: Socket, @MessageBody() dto: AskDto): Promise<void> {
    const user = client.data.user as AuthUser | undefined;
    if (!user) throw new WsException('Unauthorized');
    if (this.running.has(client.id)) throw new WsException('busy');
    const controller = new AbortController();
    this.running.set(client.id, controller);
    try {
      const events = this.chat.ask({
        user,
        question: dto.question,
        history: dto.history,
        mode: dto.mode,
        signal: controller.signal,
      });
      for await (const { type, ...payload } of events) {
        client.emit(type, payload);
      }
    } finally {
      this.running.delete(client.id);
    }
  }

  @SubscribeMessage('cancel')
  cancel(@ConnectedSocket() client: Socket): void {
    this.running.get(client.id)?.abort();
  }

  // The token is checked once, at connect. A token that expires during a long connection keeps
  // working until disconnect (accepted limitation, written in the notes).
  private authenticate(token: unknown): AuthUser {
    if (typeof token !== 'string') throw new Error('missing token');
    const payload = this.jwt.verify<JwtPayload>(token);
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
