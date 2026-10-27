import crypto from 'node:crypto';
import { getEnv } from '../config/env.js';

let sessionToken: string | null = null;

export function getSessionToken(): string {
  if (sessionToken) return sessionToken;
  const env = getEnv();
  if (env.SESSION_TOKEN && env.SESSION_TOKEN.length >= 16) {
    sessionToken = env.SESSION_TOKEN;
    return sessionToken;
  }
  sessionToken = crypto.randomBytes(32).toString('hex');
  return sessionToken;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = getSessionToken();
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.split(':')[0]?.toLowerCase() ?? '';
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}
