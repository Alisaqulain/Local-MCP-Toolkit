import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { settingsUpdateSchema } from '@local-mcp/shared';
import { getEnv, updateRuntimeSettings } from '../config/env.js';
import { listToolMeta, getRegistrySize } from '../mcp/tool-registry.js';
import { mcpClientService } from '../mcp/client.js';
import { getActiveSessionCount } from '../mcp/transport.js';
import * as notes from '../modules/notes/service.js';
import * as fsService from '../modules/filesystem/service.js';
import * as dbService from '../modules/database/service.js';
import {
  getOverview,
  listExecutions,
  getExecution,
  clearExecutions,
  exportExecutions,
  getSettings,
  saveSettings,
  pruneExecutions,
} from '../modules/statistics/service.js';
import { sessionInfo } from '../middleware/security.js';
import { checkDatabaseHealth } from '../db/database.js';
import { APP_VERSION } from '@local-mcp/shared';
import { getStartedAt } from '../modules/statistics/service.js';

function baseUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv();

  app.get('/api/health', async () => ({
    status: 'ok',
    version: APP_VERSION,
    uptimeMs: Date.now() - getStartedAt().getTime(),
    databaseHealthy: checkDatabaseHealth(),
    mcpSessions: getActiveSessionCount(),
    mcpClientConnected: mcpClientService.isConnected(),
  }));

  app.get('/api/session', async () => sessionInfo());

  app.get('/api/overview', async () => {
    // Ensure tools are registered (via a live MCP client session)
    try {
      await mcpClientService.ensureConnected(baseUrl(env.HOST, env.PORT));
    } catch {
      /* overview still works without MCP client */
    }
    return {
      data: getOverview(getRegistrySize() || listToolMeta().length, mcpClientService.isConnected()),
    };
  });

  app.get('/api/tools', async () => {
    await mcpClientService.ensureConnected(baseUrl(env.HOST, env.PORT));
    const listed = await mcpClientService.listTools(baseUrl(env.HOST, env.PORT));
    const meta = listToolMeta();
    const metaByName = new Map(meta.map((m) => [m.name, m]));
    const tools = listed.tools.map((t) => {
      const m = metaByName.get(t.name);
      return {
        name: t.name,
        description: t.description ?? m?.description ?? '',
        inputSchema: t.inputSchema,
        category: m?.category ?? 'utility',
        enabled: m?.enabled ?? true,
        readOnly: m?.readOnly ?? true,
        permission: m?.permission ?? 'read',
        timeoutMs: m?.timeoutMs ?? 30000,
        lastExecutedAt: (m as any)?.lastExecutedAt ?? null,
      };
    });
    return { data: tools };
  });

  app.post('/api/tools/:name/execute', async (req, reply) => {
    const name = (req.params as { name: string }).name;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const args = (body.arguments ?? body) as Record<string, unknown>;
    try {
      const result = await mcpClientService.callTool(baseUrl(env.HOST, env.PORT), name, args);
      return { data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      return reply.code(400).send({
        error: { code: 'TOOL_ERROR', message, requestId: req.requestId },
      });
    }
  });

  app.get('/api/mcp/status', async () => {
    let tools = 0;
    let connected = false;
    try {
      await mcpClientService.ensureConnected(baseUrl(env.HOST, env.PORT));
      const listed = await mcpClientService.listTools(baseUrl(env.HOST, env.PORT));
      tools = listed.tools.length;
      connected = true;
    } catch {
      connected = false;
    }
    return {
      data: {
        connected,
        toolCount: tools,
        sessions: getActiveSessionCount(),
        transport: 'streamable-http',
        endpoint: '/mcp',
        stdioAvailable: true,
      },
    };
  });

  // Files
  app.get('/api/files', async (req) => {
    const q = req.query as { path?: string; recursive?: string; limit?: string };
    return {
      data: fsService.listFiles({
        path: q.path,
        recursive: q.recursive === 'true',
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    };
  });

  app.get('/api/files/read', async (req, reply) => {
    const q = req.query as { path?: string };
    if (!q.path) return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'path required' } });
    try {
      return { data: fsService.readFileSafe({ path: q.path }) };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'FILE_ERROR', message: err instanceof Error ? err.message : 'Read failed' },
      });
    }
  });

  app.get('/api/files/stats', async (req) => {
    const q = req.query as { path?: string };
    return { data: fsService.getFileStats({ path: q.path }) };
  });

  app.post('/api/files/create', async (req, reply) => {
    const body = z
      .object({ path: z.string(), content: z.string().default('') })
      .parse(req.body);
    try {
      return { data: fsService.createFileSafe(body) };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'FILE_ERROR', message: err instanceof Error ? err.message : 'Create failed' },
      });
    }
  });

  app.post('/api/files/mkdir', async (req, reply) => {
    const body = z.object({ path: z.string() }).parse(req.body);
    try {
      return { data: fsService.createDirectorySafe(body) };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'FILE_ERROR', message: err instanceof Error ? err.message : 'Mkdir failed' },
      });
    }
  });

  app.get('/api/files/search', async (req) => {
    const q = req.query as {
      query?: string;
      path?: string;
      searchContent?: string;
      limit?: string;
    };
    return {
      data: fsService.searchFiles({
        query: q.query ?? '',
        path: q.path,
        searchContent: q.searchContent === 'true',
        limit: q.limit ? Number(q.limit) : undefined,
      }),
    };
  });

  // Notes
  app.get('/api/notes', async (req) => {
    const q = req.query as {
      query?: string;
      tag?: string;
      limit?: string;
      offset?: string;
      sort?: 'created' | 'updated';
    };
    if (q.query || q.tag) {
      return { data: { notes: notes.searchNotes({ query: q.query, tag: q.tag, limit: q.limit ? Number(q.limit) : undefined }), total: 0 } };
    }
    return {
      data: notes.listNotes({
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
        sort: q.sort,
      }),
    };
  });

  app.get('/api/notes/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const note = notes.getNote(id);
    if (!note) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return { data: note };
  });

  app.post('/api/notes', async (req) => {
    const body = z
      .object({
        title: z.string().min(1),
        content: z.string().default(''),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);
    return { data: notes.createNote(body) };
  });

  app.put('/api/notes/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = z
      .object({
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);
    const note = notes.updateNote({ id, ...body });
    if (!note) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    return { data: note };
  });

  app.delete('/api/notes/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = z.object({ confirm: z.literal(true) }).parse(req.body ?? { confirm: true });
    return { data: notes.deleteNote(id, body.confirm) };
  });

  // Database explorer
  app.get('/api/database/info', async () => ({ data: dbService.getDatabaseInfo() }));
  app.get('/api/database/tables', async () => ({ data: { tables: dbService.listDatabaseTables() } }));
  app.get('/api/database/tables/:name', async (req, reply) => {
    try {
      return { data: dbService.getTableInfo((req.params as { name: string }).name) };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Error' },
      });
    }
  });
  app.get('/api/database/tables/:name/rows', async (req, reply) => {
    const name = (req.params as { name: string }).name;
    const q = req.query as { limit?: string; offset?: string };
    try {
      return {
        data: dbService.browseTable(name, {
          limit: q.limit ? Number(q.limit) : undefined,
          offset: q.offset ? Number(q.offset) : undefined,
        }),
      };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Error' },
      });
    }
  });
  app.post('/api/database/query', async (req, reply) => {
    const body = z.object({ sql: z.string(), limit: z.number().optional() }).parse(req.body);
    try {
      return { data: dbService.queryDatabase(body.sql, body.limit) };
    } catch (err) {
      return reply.code(400).send({
        error: { code: 'QUERY_ERROR', message: err instanceof Error ? err.message : 'Query failed' },
      });
    }
  });

  // Executions
  app.get('/api/executions', async (req) => {
    const q = req.query as {
      toolName?: string;
      status?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };
    return {
      data: listExecutions({
        toolName: q.toolName,
        status: q.status,
        from: q.from,
        to: q.to,
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      }),
    };
  });

  app.get('/api/executions/:id', async (req, reply) => {
    const rec = getExecution(Number((req.params as { id: string }).id));
    if (!rec) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return { data: rec };
  });

  app.delete('/api/executions', async (req) => {
    const body = z.object({ confirm: z.literal(true) }).parse(req.body ?? {});
    return { data: clearExecutions(body.confirm) };
  });

  app.get('/api/executions/export', async (req, reply) => {
    const q = req.query as { format?: 'json' | 'csv'; toolName?: string; status?: string };
    const content = exportExecutions(q.format === 'csv' ? 'csv' : 'json', {
      toolName: q.toolName,
      status: q.status,
    });
    reply.header(
      'content-type',
      q.format === 'csv' ? 'text/csv' : 'application/json',
    );
    return content;
  });

  // Settings
  app.get('/api/settings', async () => ({ data: getSettings() }));

  app.put('/api/settings', async (req) => {
    const patch = settingsUpdateSchema.parse(req.body);
    const current = getSettings();
    const next = { ...current, ...patch };
    saveSettings(next);
    updateRuntimeSettings({
      maxFileReadBytes: next.maxFileReadBytes,
      maxSearchResults: next.maxSearchResults,
      allowedExtensions: next.allowedExtensions,
      excludedDirectories: next.excludedDirectories,
      logRetentionDays: next.logRetentionDays,
    });
    pruneExecutions(next.logRetentionDays);
    return { data: next };
  });

  // Optional local AI status (no external calls unless enabled)
  app.get('/api/ai/status', async () => {
    const settings = getSettings();
    const enabled = !!settings.localAiEnabled && !!env.LOCAL_AI_ENABLED;
    if (!enabled) {
      return {
        data: {
          enabled: false,
          connected: false,
          message: 'Local AI is disabled. Configure Ollama on localhost in Settings to enable.',
        },
      };
    }
    try {
      const url = new URL('/api/tags', settings.localAiBaseUrl || env.LOCAL_AI_BASE_URL);
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
        return {
          data: { enabled: true, connected: false, message: 'Local AI base URL must be localhost' },
        };
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        return { data: { enabled: true, connected: false, message: 'Ollama not reachable' } };
      }
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      return {
        data: {
          enabled: true,
          connected: true,
          models: (json.models ?? []).map((m) => m.name),
          configuredModel: settings.localAiModel || env.LOCAL_AI_MODEL || null,
        },
      };
    } catch {
      return {
        data: {
          enabled: true,
          connected: false,
          message: 'Could not reach local AI endpoint',
        },
      };
    }
  });
}
