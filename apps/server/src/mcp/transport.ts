import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import { logger } from '../logging/logger.js';
import { getEnv } from '../config/env.js';

type Session = {
  transport: StreamableHTTPServerTransport;
  server: ReturnType<typeof createMcpServer>;
};

const sessions = new Map<string, Session>();

export function getActiveSessionCount(): number {
  return sessions.size;
}

export async function closeAllMcpSessions(): Promise<void> {
  for (const [id, session] of sessions) {
    try {
      await session.transport.close();
    } catch (err) {
      logger.warn({ err, id }, 'Error closing MCP session');
    }
  }
  sessions.clear();
}

function allowedHostsForRequest(req: FastifyRequest): string[] {
  const hostHeader = req.headers.host;
  const base = ['127.0.0.1', 'localhost', '[::1]', '::1'];
  const withPorts = [...base];
  if (hostHeader && isLoopbackHostHeader(hostHeader)) {
    withPorts.push(hostHeader);
  }
  try {
    const env = getEnv();
    withPorts.push(`${env.HOST}:${env.PORT}`, `127.0.0.1:${env.PORT}`, `localhost:${env.PORT}`);
  } catch {
    /* ignore during early boot */
  }
  return Array.from(new Set(withPorts));
}

function isLoopbackHostHeader(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.startsWith('127.0.0.1') ||
    h.startsWith('localhost') ||
    h.startsWith('[::1]') ||
    h.startsWith('::1')
  );
}

export function registerMcpHttpTransport(app: FastifyInstance): void {
  app.post('/mcp', async (req, reply) => {
    await handlePost(req, reply);
  });

  app.get('/mcp', async (req, reply) => {
    await handleSessionRequest(req, reply);
  });

  app.delete('/mcp', async (req, reply) => {
    await handleSessionRequest(req, reply);
  });
}

async function handlePost(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  try {
    let session = sessionId ? sessions.get(sessionId) : undefined;

    if (session) {
      reply.hijack();
      await session.transport.handleRequest(req.raw, reply.raw, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      if (sessions.size >= 50) {
        reply.code(503).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Too many open sessions' },
          id: null,
        });
        return;
      }

      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        enableDnsRebindingProtection: true,
        allowedHosts: allowedHostsForRequest(req),
        onsessioninitialized: (newSid) => {
          sessions.set(newSid, { transport, server });
          logger.info({ sid: newSid }, 'MCP session initialized');
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          sessions.delete(sid);
          logger.info({ sid }, 'MCP session closed');
        }
      };

      await server.connect(transport);

      reply.hijack();
      await transport.handleRequest(req.raw, reply.raw, req.body);

      if (transport.sessionId && !sessions.has(transport.sessionId)) {
        sessions.set(transport.sessionId, { transport, server });
      }
      return;
    }

    if (sessionId) {
      reply.code(404).send({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return;
    }

    reply.code(400).send({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null,
    });
  } catch (err) {
    logger.error({ err }, 'MCP POST handler error');
    if (!reply.sent && !reply.raw.headersSent) {
      reply.code(500).send({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

async function handleSessionRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    reply.code(400).send('Invalid or missing session ID');
    return;
  }
  const session = sessions.get(sessionId)!;
  try {
    reply.hijack();
    await session.transport.handleRequest(req.raw, reply.raw);
  } catch (err) {
    logger.error({ err }, 'MCP session request error');
    if (!reply.raw.headersSent) {
      reply.raw.statusCode = 500;
      reply.raw.end('Internal server error');
    }
  }
}
