/**
 * Standalone MCP server over stdio — for Cursor / Claude Desktop / other MCP clients.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getEnv } from '../config/env.js';
import { openDatabase } from '../db/database.js';
import { ensureWorkspaceExists } from '../security/paths.js';
import { ensureSettingsDefaults } from '../modules/statistics/service.js';
import { createMcpServer } from './server.js';

async function main() {
  const env = getEnv();
  ensureWorkspaceExists(env.workspaceAbsolute);
  openDatabase(env.databaseAbsolute);
  ensureSettingsDefaults();

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
