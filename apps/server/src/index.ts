import { APP_NAME } from '@local-mcp/shared';
import { getEnv } from './config/env.js';
import { closeDatabase } from './db/database.js';
import { logger } from './logging/logger.js';
import { getSessionToken } from './security/session.js';
import { closeAllMcpSessions } from './mcp/transport.js';
import { mcpClientService } from './mcp/client.js';
import { createApp } from './create-app.js';
import { getRegistrySize } from './mcp/tool-registry.js';
import { isVercelRuntime } from './platform/runtime.js';

async function main() {
  if (isVercelRuntime()) {
    // Vercel invokes src/vercel.ts — do not listen here
    logger.info('VERCEL runtime detected — use vercel.ts handler (no listen)');
    return;
  }

  const env = getEnv();
  const app = await createApp();

  if (!env.allowNonLoopback && env.HOST !== '127.0.0.1' && env.HOST !== 'localhost' && env.HOST !== '::1') {
    logger.warn({ host: env.HOST }, 'HOST is not loopback');
  }

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
  if (env.HOST === '127.0.0.1' || env.HOST === 'localhost') {
    logger.info({ sessionTokenPreview: token.slice(0, 8) + '…' }, 'Session token ready');
  }

  try {
    const connectHost = env.HOST === '0.0.0.0' ? '127.0.0.1' : env.HOST;
    await mcpClientService.connect(`http://${connectHost}:${env.PORT}`);
    logger.info('Dashboard MCP client connected');
  } catch (err) {
    logger.warn({ err }, 'HTTP MCP connect failed — using in-memory MCP client');
    await mcpClientService.connectInMemory();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
