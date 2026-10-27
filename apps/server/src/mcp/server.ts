import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { APP_NAME, APP_VERSION } from '@local-mcp/shared';
import { registerAllTools } from './tools/index.js';
import { clearRegistry } from './tool-registry.js';

export function createMcpServer(): McpServer {
  clearRegistry();
  const server = new McpServer({
    name: APP_NAME,
    version: APP_VERSION,
  });
  registerAllTools(server);
  return server;
}
