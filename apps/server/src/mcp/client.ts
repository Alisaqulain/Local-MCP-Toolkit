import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { APP_NAME, APP_VERSION } from '@local-mcp/shared';
import { logger } from '../logging/logger.js';

export class McpClientService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private connected = false;
  private baseUrl = '';

  isConnected(): boolean {
    return this.connected;
  }

  async connect(baseUrl: string): Promise<void> {
    if (this.connected && this.client) {
      return;
    }
    await this.disconnect();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    const url = new URL(`${this.baseUrl}/mcp`);
    this.transport = new StreamableHTTPClientTransport(url);
    this.client = new Client({ name: `${APP_NAME} Dashboard`, version: APP_VERSION });
    await this.client.connect(this.transport);
    this.connected = true;
    logger.info({ url: url.toString() }, 'MCP client connected');
  }

  async ensureConnected(baseUrl: string): Promise<Client> {
    if (!this.connected || !this.client) {
      await this.connect(baseUrl);
    }
    return this.client!;
  }

  async listTools(baseUrl: string) {
    const client = await this.ensureConnected(baseUrl);
    return client.listTools();
  }

  async callTool(baseUrl: string, name: string, args: Record<string, unknown>) {
    const client = await this.ensureConnected(baseUrl);
    return client.callTool({ name, arguments: args });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    try {
      await this.transport?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.client?.close();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.transport = null;
  }
}

export const mcpClientService = new McpClientService();
