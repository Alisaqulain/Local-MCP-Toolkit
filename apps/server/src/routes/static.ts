import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { detectProjectRoot, getEnv } from '../config/env.js';
import { logger } from '../logging/logger.js';

/**
 * Serve the Vite production build from the same Fastify process.
 * Register API (/api/*) and MCP (/mcp) before calling this.
 */
export async function registerWebStatic(app: FastifyInstance): Promise<boolean> {
  const env = getEnv();
  if (!env.serveWeb) {
    logger.info('Skipping static frontend (dev mode — use Vite on :5173 with proxy)');
    return false;
  }

  const candidates = [
    env.webDistAbsolute,
    path.join(env.projectRoot, 'apps', 'web', 'dist'),
    path.join(detectProjectRoot(), 'apps', 'web', 'dist'),
  ];

  const webDist = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (!webDist) {
    logger.warn(
      { tried: candidates },
      'Frontend build not found — API/MCP only. Run: npm run build',
    );
    return false;
  }

  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
    wildcard: false,
    decorateReply: true,
  });

  app.setNotFoundHandler((req, reply) => {
    const pathname = req.url.split('?')[0] ?? '';

    // Never fall back to index.html for API/MCP — return JSON 404
    if (pathname.startsWith('/api') || pathname.startsWith('/mcp')) {
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `No route for ${req.method} ${pathname}`,
          requestId: req.requestId,
        },
      });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      return reply.type('text/html').sendFile('index.html');
    }

    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Not found', requestId: req.requestId },
    });
  });

  logger.info({ webDist }, 'Serving Vite frontend from Fastify (single origin)');
  return true;
}
