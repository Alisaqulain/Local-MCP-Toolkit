/**
 * Vercel Functions / Services entrypoint for the Fastify backend.
 * Export a Node-style (req, res) handler — used when framework=fastify.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from './create-app.js';
import { logger } from './logging/logger.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (err) {
    logger.error({ err }, 'Vercel handler failure');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Server failed to start' } }));
    }
  }
}
