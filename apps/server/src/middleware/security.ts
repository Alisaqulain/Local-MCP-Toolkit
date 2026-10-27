import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env.js';
import { getSessionToken, isLoopbackHost, verifySessionToken } from '../security/session.js';
import { isVercelRuntime } from '../platform/runtime.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

function hostAllowed(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const env = getEnv();
  const host = hostHeader.toLowerCase();
  const hostname = host.split(':')[0] ?? host;

  if (isLoopbackHost(hostHeader)) return true;

  // Vercel deployment / preview hosts
  if (isVercelRuntime() && (hostname.endsWith('.vercel.app') || hostname.includes('vercel'))) {
    return true;
  }

  if (!env.allowNonLoopback) return false;

  if (env.allowedHosts.length === 0) return true;

  return (
    env.allowedHosts.includes(host) ||
    env.allowedHosts.includes(hostname) ||
    env.allowedHosts.some((h) => host === h || hostname === h)
  );
}

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID();
    reply.header('x-request-id', req.requestId);

    const host = req.headers.host;
    if (host && !hostAllowed(host)) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN_HOST',
          message: 'Host not allowed. Set ALLOW_NON_LOOPBACK=true and ALLOWED_HOSTS for remote access.',
          requestId: req.requestId,
        },
      });
    }

    const origin = req.headers.origin;
    if (origin) {
      const env = getEnv();
      if (env.allowedOrigins.includes(origin)) return;
      try {
        const hostname = new URL(origin).hostname;
        if (isVercelRuntime() && hostname.endsWith('.vercel.app')) return;
      } catch {
        /* fall through */
      }
      return reply.code(403).send({
        error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed', requestId: req.requestId },
      });
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
