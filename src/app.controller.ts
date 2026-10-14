import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  // Small public landing route: proves the app is up and points at the docs and the chat page.
  @Public()
  @Get()
  info(): { name: string; docs: string; chat: string } {
    return { name: 'nestjs-rag', docs: '/docs', chat: '/ui/chat.html' };
  }
}
