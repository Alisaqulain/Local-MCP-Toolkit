import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { openDatabase, closeDatabase, setDatabase } from '../../apps/server/src/db/database.js';
import { setEnvForTests, type Env } from '../../apps/server/src/config/env.js';
import { registerMcpHttpTransport, closeAllMcpSessions } from '../../apps/server/src/mcp/transport.js';
import { createMcpServer } from '../../apps/server/src/mcp/server.js';
import { ensureSettingsDefaults } from '../../apps/server/src/modules/statistics/service.js';
import { getRegistrySize } from '../../apps/server/src/mcp/tool-registry.js';

describe('MCP protocol integration', () => {
  let baseUrl = '';
  let app: ReturnType<typeof Fastify>;
  let client: Client;
  let workspace: string;

  beforeAll(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-int-'));
    fs.writeFileSync(path.join(workspace, 'sample.txt'), 'integration sample');
    const dbPath = path.join(workspace, 'test.sqlite');
    const env = {
      HOST: '127.0.0.1',
      PORT: 0,
      WEB_ORIGIN: 'http://127.0.0.1:5173',
      WORKSPACE_PATH: workspace,
      DATABASE_PATH: dbPath,
      LOG_LEVEL: 'error' as const,
      MAX_FILE_READ_BYTES: 1_048_576,
      MAX_SEARCH_RESULTS: 50,
      MAX_QUERY_ROWS: 100,
      REQUEST_BODY_LIMIT: 1_000_000,
      LOCAL_AI_ENABLED: false,
      LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434',
      LOCAL_AI_MODEL: '',
      ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
      LOG_RETENTION_DAYS: 30,
      workspaceAbsolute: workspace,
      databaseAbsolute: dbPath,
      allowedOrigins: ['http://127.0.0.1:5173'],
      allowedExtensions: ['.txt', '.md', '.json'],
      excludedDirectories: ['node_modules'],
      projectRoot: workspace,
    } satisfies Env;
    setEnvForTests(env);
    setDatabase(openDatabase(dbPath));
    ensureSettingsDefaults();
    createMcpServer();
    expect(getRegistrySize()).toBeGreaterThan(10);

    app = Fastify({ logger: false });
    registerMcpHttpTransport(app);
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') throw new Error('No address');
    baseUrl = `http://127.0.0.1:${addr.port}`;

    client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
    await closeAllMcpSessions();
    await app?.close();
    closeDatabase();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('discovers tools via MCP', async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    expect(names).toContain('get_workspace_info');
    expect(names).toContain('create_note');
    expect(names).toContain('list_files');
  });

  it('executes get_workspace_info', async () => {
    const result = await client.callTool({ name: 'get_workspace_info', arguments: {} });
    expect(result.isError).not.toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]?.text ?? '';
    expect(text).toContain('workspacePath');
  });

  it('creates and searches a note via MCP', async () => {
    const created = await client.callTool({
      name: 'create_note',
      arguments: { title: 'MCP Note', content: 'from integration test', tags: ['test'] },
    });
    expect(created.isError).not.toBe(true);
    const searched = await client.callTool({
      name: 'search_notes',
      arguments: { query: 'MCP Note' },
    });
    expect(searched.isError).not.toBe(true);
    const text = (searched.content as Array<{ text: string }>)[0]?.text ?? '';
    expect(text).toContain('MCP Note');
  });

  it('reads a workspace file via MCP', async () => {
    const result = await client.callTool({
      name: 'read_file',
      arguments: { path: 'sample.txt' },
    });
    expect(result.isError).not.toBe(true);
    const text = (result.content as Array<{ text: string }>)[0]?.text ?? '';
    expect(text).toContain('integration sample');
  });

  it('returns error for invalid input', async () => {
    const result = await client.callTool({
      name: 'read_file',
      arguments: { path: '../outside.txt' },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects unsafe SQL via MCP', async () => {
    const result = await client.callTool({
      name: 'query_database',
      arguments: { sql: 'DELETE FROM notes' },
    });
    expect(result.isError).toBe(true);
  });
});
