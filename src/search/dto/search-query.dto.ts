import { OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { trim } from '../../common/transforms.js';
import { SEARCH_MODES, type SearchMode } from '../search.types.js';

export class SearchQueryDto {
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  q: string;

  @IsOptional()
  @IsIn(SEARCH_MODES)
  mode: SearchMode = 'hybrid';

  // Query strings are strings: @Type turns "5" into 5 before the number checks run.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK: number = 10;
}

// Mapped type: same fields, rules and defaults, minus `mode`.
export class CompareQueryDto extends OmitType(SearchQueryDto, ['mode'] as const) {}
