import pino from 'pino';
import { getEnv } from '../config/env.js';

export function createLogger(name = 'local-mcp') {
  const env = getEnv();
  const isDev = process.env.NODE_ENV !== 'production';
  return pino({
    name,
    level: env.LOG_LEVEL,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
  });
}

export const logger = createLogger();
