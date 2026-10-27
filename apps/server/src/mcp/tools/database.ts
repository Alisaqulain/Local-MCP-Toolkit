import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as dbService from '../../modules/database/service.js';
import { registerZodTool } from './register.js';

export function registerDatabaseTools(server: McpServer): void {
  registerZodTool(server, {
    name: 'get_database_info',
    description: 'Return application SQLite database info and health',
    category: 'database',
    readOnly: true,
    permission: 'read',
    schema: z.object({}),
    handler: async () => dbService.getDatabaseInfo(),
  });

  registerZodTool(server, {
    name: 'list_database_tables',
    description: 'List tables in the application database',
    category: 'database',
    readOnly: true,
    permission: 'read',
    schema: z.object({}),
    handler: async () => ({ tables: dbService.listDatabaseTables() }),
  });

  registerZodTool(server, {
    name: 'query_database',
    description: 'Run a safe read-only SELECT against the application database',
    category: 'database',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      sql: z.string().min(1).max(10_000),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    handler: async (a) => dbService.queryDatabase(a.sql, a.limit),
  });
}
