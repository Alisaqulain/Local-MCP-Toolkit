import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './config/env.js';
import { openDatabase } from './db/database.js';
import { logger } from './logging/logger.js';
import { ensureWorkspaceExists } from './security/paths.js';
import { registerSecurity, requireSession } from './middleware/security.js';
import { registerMcpHttpTransport } from './mcp/transport.js';
import { createMcpServer } from './mcp/server.js';
import { mcpClientService } from './mcp/client.js';
import { registerApiRoutes } from './routes/api.js';
import { registerWebStatic } from './routes/static.js';
import { ensureSettingsDefaults, pruneExecutions } from './modules/statistics/service.js';
import { getRegistrySize } from './mcp/tool-registry.js';
import { seedVercelWorkspace } from './platform/vercel-storage.js';
import { isVercelRuntime } from './platform/runtime.js';

let appPromise: Promise<FastifyInstance> | null = null;

export async function createApp(): Promise<FastifyInstance> {
  const env = getEnv();

  ensureWorkspaceExists(env.workspaceAbsolute);
  if (isVercelRuntime()) {
    seedVercelWorkspace(env.workspaceAbsolute);
  }
  openDatabase(env.databaseAbsolute);
  ensureSettingsDefaults();
  try {
    pruneExecutions(env.LOG_RETENTION_DAYS);
  } catch {
    /* ignore prune failures on fresh /tmp db */
  }

  createMcpServer();
  logger.info({ tools: getRegistrySize(), vercel: isVercelRuntime() }, 'MCP tools registered');

  // Prefer in-process MCP on Vercel (no self-HTTP); also fine locally as fallback
  if (isVercelRuntime()) {
    await mcpClientService.connectInMemory();
  }

  const app = Fastify({
    logger: false,
    bodyLimit: env.REQUEST_BODY_LIMIT,
    trustProxy: env.allowNonLoopback || isVercelRuntime(),
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (env.allowedOrigins.includes(origin)) return cb(null, true);
      // Allow Vercel preview/production URLs
      if (isVercelRuntime() && /\.vercel\.app$/i.test(new URL(origin).hostname)) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Token',
      'X-Request-Id',
      'Mcp-Session-Id',
      'mcp-session-id',
    ],
    exposedHeaders: ['Mcp-Session-Id', 'mcp-session-id', 'X-Request-Id'],
  });

  await app.register(rateLimit, {
    max: isVercelRuntime() ? 120 : 300,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'],
  });

  await registerSecurity(app);
  app.addHook('preHandler', requireSession);

  registerMcpHttpTransport(app);
  await registerApiRoutes(app);

  // Multi-service Vercel: UI is the separate `web` service — do not serve static here
  if (!isVercelRuntime()) {
    await registerWebStatic(app);
  }

  return app;
}

/** Lazy singleton for serverless warm starts */
export function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

export function resetAppCache(): void {
  appPromise = null;
}
