import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { APP_NAME } from '@local-mcp/shared';
import { getEnv } from './config/env.js';
import { openDatabase, closeDatabase } from './db/database.js';
import { logger } from './logging/logger.js';
import { ensureWorkspaceExists } from './security/paths.js';
import { getSessionToken } from './security/session.js';
import { registerSecurity, requireSession } from './middleware/security.js';
import { registerMcpHttpTransport, closeAllMcpSessions } from './mcp/transport.js';
import { createMcpServer } from './mcp/server.js';
import { mcpClientService } from './mcp/client.js';
import { registerApiRoutes } from './routes/api.js';
import { ensureSettingsDefaults, pruneExecutions } from './modules/statistics/service.js';
import { getRegistrySize } from './mcp/tool-registry.js';

async function main() {
  const env = getEnv();

  // Bind loopback only by default
  if (env.HOST !== '127.0.0.1' && env.HOST !== 'localhost' && env.HOST !== '::1') {
    logger.warn({ host: env.HOST }, 'HOST is not loopback — ensure you understand the security implications');
  }

  ensureWorkspaceExists(env.workspaceAbsolute);
  openDatabase(env.databaseAbsolute);
  ensureSettingsDefaults();
  pruneExecutions(env.LOG_RETENTION_DAYS);

  // Populate tool registry at startup
  createMcpServer();
  logger.info({ tools: getRegistrySize() }, 'MCP tools registered');

  const app = Fastify({
    logger: false,
    bodyLimit: env.REQUEST_BODY_LIMIT,
    trustProxy: false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser / same-origin
      cb(null, env.allowedOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Request-Id', 'Mcp-Session-Id', 'mcp-session-id'],
    exposedHeaders: ['Mcp-Session-Id', 'mcp-session-id', 'X-Request-Id'],
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'],
  });

  await registerSecurity(app);
  app.addHook('preHandler', requireSession);

  // MCP Streamable HTTP (real protocol)
  registerMcpHttpTransport(app);

  await registerApiRoutes(app);

  const token = getSessionToken();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    try {
      await mcpClientService.disconnect();
      await closeAllMcpSessions();
      await app.close();
      closeDatabase();
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
      workspace: env.workspaceAbsolute,
      database: env.databaseAbsolute,
      tools: getRegistrySize(),
    },
    `${APP_NAME} listening`,
  );
  logger.info('Session token available at GET /api/session');
  // Keep token visible once in logs for local DX (loopback only)
  if (env.HOST === '127.0.0.1' || env.HOST === 'localhost') {
    logger.info({ sessionTokenPreview: token.slice(0, 8) + '…' }, 'Session token ready');
  }

  // Warm MCP client connection after listen
  try {
    await mcpClientService.connect(`http://${env.HOST}:${env.PORT}`);
    logger.info('Dashboard MCP client connected');
  } catch (err) {
    logger.warn({ err }, 'MCP client warm-connect failed (will retry on demand)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
