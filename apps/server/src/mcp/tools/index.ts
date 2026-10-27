import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFilesystemTools } from './filesystem.js';
import { registerNotesTools } from './notes.js';
import { registerDatabaseTools } from './database.js';
import { registerUtilityTools } from './utility.js';

export function registerAllTools(server: McpServer): void {
  registerFilesystemTools(server);
  registerNotesTools(server);
  registerDatabaseTools(server);
  registerUtilityTools(server);
}
