import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SearchModule } from '../search/search.module.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [AuthModule, SearchModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
