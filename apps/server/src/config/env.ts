import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_ALLOWED_EXTENSIONS,
  DEFAULT_EXCLUDED_DIRS,
  DEFAULT_HOST,
  DEFAULT_LOG_RETENTION_DAYS,
  DEFAULT_MAX_FILE_READ_BYTES,
  DEFAULT_MAX_QUERY_ROWS,
  DEFAULT_MAX_SEARCH_RESULTS,
  DEFAULT_PORT,
  DEFAULT_REQUEST_BODY_LIMIT,
} from '@local-mcp/shared';

export function detectProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'data'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRootEarly = detectProjectRoot();
loadDotenv({ path: path.join(projectRootEarly, '.env') });

const boolish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  HOST: z.string().default(DEFAULT_HOST),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  WEB_ORIGIN: z.string().default('http://127.0.0.1:5173'),
  PUBLIC_ORIGIN: z.string().optional(),
  WORKSPACE_PATH: z.string().default('./data/workspace'),
  DATABASE_PATH: z.string().default('./data/db/toolkit.sqlite'),
  WEB_DIST_PATH: z.string().default('./apps/web/dist'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MAX_FILE_READ_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10_485_760)
    .default(DEFAULT_MAX_FILE_READ_BYTES),
  MAX_SEARCH_RESULTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(DEFAULT_MAX_SEARCH_RESULTS),
  MAX_QUERY_ROWS: z.coerce.number().int().min(1).max(1000).default(DEFAULT_MAX_QUERY_ROWS),
  REQUEST_BODY_LIMIT: z.coerce.number().int().min(1024).default(DEFAULT_REQUEST_BODY_LIMIT),
  SESSION_TOKEN: z.string().optional(),
  LOCAL_AI_ENABLED: boolish,
  LOCAL_AI_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  LOCAL_AI_MODEL: z.string().default(''),
  ALLOWED_ORIGINS: z
    .string()
    .default(
      'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3847,http://localhost:3847',
    ),
  ALLOWED_HOSTS: z.string().optional(),
  ALLOW_NON_LOOPBACK: boolish,
  SERVE_WEB: boolish,
  LOG_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(DEFAULT_LOG_RETENTION_DAYS),
});

export type Env = z.infer<typeof envSchema> & {
  workspaceAbsolute: string;
  databaseAbsolute: string;
  webDistAbsolute: string;
  allowedOrigins: string[];
  allowedHosts: string[];
  allowedExtensions: string[];
  excludedDirectories: string[];
  projectRoot: string;
  serveWeb: boolean;
  allowNonLoopback: boolean;
};

function resolveFromRoot(p: string, root: string): string {
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(root, p);
}

export function loadEnv(projectRoot = detectProjectRoot()): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${msg}`);
  }
  const e = parsed.data;

  const allowedOrigins = e.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Same-origin production: auto-allow PUBLIC_ORIGIN and the listening origin
  if (e.PUBLIC_ORIGIN && !allowedOrigins.includes(e.PUBLIC_ORIGIN)) {
    allowedOrigins.push(e.PUBLIC_ORIGIN);
  }
  const listenOrigin = `http://${e.HOST === '0.0.0.0' ? '127.0.0.1' : e.HOST}:${e.PORT}`;
  if (!allowedOrigins.includes(listenOrigin)) {
    allowedOrigins.push(listenOrigin);
  }
  const localhostOrigin = `http://localhost:${e.PORT}`;
  if (!allowedOrigins.includes(localhostOrigin)) {
    allowedOrigins.push(localhostOrigin);
  }

  const allowedHosts = (e.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const serveWeb = Boolean(e.SERVE_WEB) || process.env.NODE_ENV === 'production';
  const allowNonLoopback = Boolean(e.ALLOW_NON_LOOPBACK);

  return {
    ...e,
    projectRoot,
    workspaceAbsolute: resolveFromRoot(e.WORKSPACE_PATH, projectRoot),
    databaseAbsolute: resolveFromRoot(e.DATABASE_PATH, projectRoot),
    webDistAbsolute: resolveFromRoot(e.WEB_DIST_PATH, projectRoot),
    allowedOrigins,
    allowedHosts,
    allowedExtensions: [...DEFAULT_ALLOWED_EXTENSIONS],
    excludedDirectories: [...DEFAULT_EXCLUDED_DIRS],
    serveWeb,
    allowNonLoopback,
  };
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    cached = loadEnv(detectProjectRoot());
  }
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function setEnvForTests(env: Env): void {
  cached = env;
}

export function updateRuntimeSettings(
  patch: Partial<{
    maxFileReadBytes: number;
    maxSearchResults: number;
    allowedExtensions: string[];
    excludedDirectories: string[];
    logRetentionDays: number;
  }>,
): Env {
  const env = getEnv();
  if (patch.maxFileReadBytes != null) {
    env.MAX_FILE_READ_BYTES = patch.maxFileReadBytes;
  }
  if (patch.maxSearchResults != null) {
    env.MAX_SEARCH_RESULTS = patch.maxSearchResults;
  }
  if (patch.allowedExtensions) {
    env.allowedExtensions = patch.allowedExtensions;
  }
  if (patch.excludedDirectories) {
    env.excludedDirectories = patch.excludedDirectories;
  }
  if (patch.logRetentionDays != null) {
    env.LOG_RETENTION_DAYS = patch.logRetentionDays;
  }
  return env;
}
