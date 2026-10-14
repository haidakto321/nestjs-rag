import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { CHAT_MODES, type ChatMode } from '../chat-events.js';

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @Length(1, 4000)
  content: string;
}

export class AskDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  question: string;

  // History lives on the client (stateless server), capped to keep prompts bounded.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history: ChatTurnDto[] = [];

  @IsOptional()
  @IsIn(CHAT_MODES)
  mode: ChatMode = 'rag';
}
