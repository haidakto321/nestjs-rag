import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CompareQueryDto, SearchQueryDto } from './dto/search-query.dto.js';
import { SearchService } from './search.service.js';
import type { CompareResult, SearchResult } from './search.types.js';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto): Promise<SearchResult> {
    return this.searchService.search(user, query.q, query.mode, query.topK);
  }

  @Get('compare')
  compare(@CurrentUser() user: AuthUser, @Query() query: CompareQueryDto): Promise<CompareResult> {
    return this.searchService.compare(user, query.q, query.topK);
  }
}
