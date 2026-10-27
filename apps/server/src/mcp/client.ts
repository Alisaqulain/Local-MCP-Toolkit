import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { APP_NAME, APP_VERSION } from '@local-mcp/shared';
import { createMcpServer } from './server.js';
import { logger } from '../logging/logger.js';

export class McpClientService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | InMemoryTransport | null = null;
  private connected = false;
  private mode: 'http' | 'memory' | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  /** Real MCP over linked in-memory transports (same process — used on Vercel). */
  async connectInMemory(): Promise<void> {
    if (this.connected && this.client && this.mode === 'memory') return;
    await this.disconnect();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(serverTransport);

    this.client = new Client({ name: `${APP_NAME} Dashboard`, version: APP_VERSION });
    await this.client.connect(clientTransport);
    this.transport = clientTransport;
    this.connected = true;
    this.mode = 'memory';
    logger.info('MCP client connected (in-memory transport)');
  }

  async connect(baseUrl: string): Promise<void> {
    if (this.connected && this.client && this.mode === 'http') return;
    await this.disconnect();
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/mcp`);
    this.transport = new StreamableHTTPClientTransport(url);
    this.client = new Client({ name: `${APP_NAME} Dashboard`, version: APP_VERSION });
    await this.client.connect(this.transport);
    this.connected = true;
    this.mode = 'http';
    logger.info({ url: url.toString() }, 'MCP client connected (streamable HTTP)');
  }

  async ensureConnected(baseUrl?: string): Promise<Client> {
    if (this.connected && this.client) return this.client;
    if (!baseUrl) {
      await this.connectInMemory();
    } else {
      try {
        await this.connect(baseUrl);
      } catch (err) {
        logger.warn({ err }, 'HTTP MCP connect failed — falling back to in-memory');
        await this.connectInMemory();
      }
    }
    return this.client!;
  }

  async listTools(baseUrl?: string) {
    const client = await this.ensureConnected(baseUrl);
    return client.listTools();
  }

  async callTool(baseUrl: string | undefined, name: string, args: Record<string, unknown>) {
    const client = await this.ensureConnected(baseUrl);
    return client.callTool({ name, arguments: args });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.mode = null;
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
