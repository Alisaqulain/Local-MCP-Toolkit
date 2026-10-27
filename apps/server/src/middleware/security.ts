import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { getSessionToken, isLoopbackHost, verifySessionToken } from '../security/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    reply.header('x-request-id', req.requestId);

    // Reject non-loopback Host headers (DNS rebinding mitigation)
    const host = req.headers.host;
    if (host && !isLoopbackHost(host)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN_HOST', message: 'Only loopback hosts are allowed', requestId: req.requestId },
      });
    }

    // Origin validation for browser mutating requests
    const origin = req.headers.origin;
    if (origin) {
      const env = getEnv();
      if (!env.allowedOrigins.includes(origin)) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed', requestId: req.requestId },
        });
      }
    }
  });
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/session', '/mcp']);

export async function requireSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const path = req.url.split('?')[0] ?? '';
  if (path === '/mcp' || path.startsWith('/mcp?')) return;
  if (PUBLIC_PATHS.has(path)) return;
  if (!path.startsWith('/api/')) return;

  const token =
    (req.headers['x-session-token'] as string | undefined) ||
    (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!verifySessionToken(token)) {
    reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid session token required',
        requestId: req.requestId,
      },
    });
  }
}

export function sessionInfo() {
  return { token: getSessionToken() };
}
