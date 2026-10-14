import { tool } from 'ai';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import type { SearchService } from '../search/search.service.js';
import type { ChunkMatch } from '../search/search.types.js';
import { buildContextBlock } from './prompt.js';

export const AGENT_SEARCH_LIMIT = 5;

/**
 * Tools are built per request. The caller is captured in this closure, so the model chooses WHAT
 * to search but never WHOSE documents: permissions never come from model input.
 * onResult reports the matches and returns the first passage number to use for them.
 */
export function buildAgentTools(search: SearchService, user: AuthUser, onResult: (matches: ChunkMatch[]) => number) {
  return {
    searchDocuments: tool({
      description: 'Search the documents this user may read. Returns numbered passages to cite.',
      inputSchema: z.object({ query: z.string().min(1).max(500).describe('Words or a question to search for') }),
      execute: async ({ query }: { query: string }) => {
        const matches = await search.retrieve(user, query, AGENT_SEARCH_LIMIT);
        const firstNumber = onResult(matches);
        return matches.length > 0 ? buildContextBlock(matches, firstNumber) : 'No passages found.';
      },
    }),
  };
}
