import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getEnv } from '../../config/env.js';
import { getFileStats, searchFiles } from '../../modules/filesystem/service.js';
import { searchNotes } from '../../modules/notes/service.js';
import { calculate } from '../../utils/calculate.js';
import { registerZodTool } from './register.js';

export function registerUtilityTools(server: McpServer): void {
  registerZodTool(server, {
    name: 'get_current_time',
    description: 'Return local system time and timezone',
    category: 'utility',
    readOnly: true,
    permission: 'read',
    schema: z.object({}),
    handler: async () => {
      const now = new Date();
      return {
        iso: now.toISOString(),
        local: now.toString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offsetMinutes: now.getTimezoneOffset(),
        unixMs: now.getTime(),
      };
    },
  });

  registerZodTool(server, {
    name: 'calculate',
    description: 'Evaluate a safe arithmetic expression (no eval)',
    category: 'utility',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      expression: z.string().min(1).max(200).describe('Arithmetic expression, e.g. (2+3)*4'),
    }),
    handler: async (a) => ({
      expression: a.expression,
      result: calculate(a.expression),
    }),
  });

  registerZodTool(server, {
    name: 'get_workspace_info',
    description: 'Return workspace path, limits, and statistics',
    category: 'utility',
    readOnly: true,
    permission: 'read',
    schema: z.object({}),
    handler: async () => {
      const env = getEnv();
      return {
        workspacePath: env.WORKSPACE_PATH,
        workspaceAbsoluteConfigured: true,
        allowedExtensions: env.allowedExtensions,
        excludedDirectories: env.excludedDirectories,
        maxFileReadBytes: env.MAX_FILE_READ_BYTES,
        maxSearchResults: env.MAX_SEARCH_RESULTS,
        stats: getFileStats({}),
      };
    },
  });

  registerZodTool(server, {
    name: 'search_workspace',
    description: 'Search workspace text files and saved notes with one query',
    category: 'search',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      query: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async (a) => {
      const limit = a.limit ?? 20;
      const files = searchFiles({ query: a.query, searchContent: true, limit });
      const noteHits = searchNotes({ query: a.query, limit });
      return { files: files.results, notes: noteHits, truncated: files.truncated };
    },
  });
}
