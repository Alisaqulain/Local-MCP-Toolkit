import type { Env } from '../../apps/server/src/config/env.js';

/** Minimal Env stub for unit/integration tests */
export function testEnv(overrides: Partial<Env> & Pick<Env, 'workspaceAbsolute' | 'databaseAbsolute'>): Env {
  const workspace = overrides.workspaceAbsolute;
  return {
    HOST: '127.0.0.1',
    PORT: 3847,
    WEB_ORIGIN: 'http://127.0.0.1:5173',
    PUBLIC_ORIGIN: undefined,
    WORKSPACE_PATH: workspace,
    DATABASE_PATH: overrides.databaseAbsolute,
    WEB_DIST_PATH: './apps/web/dist',
    LOG_LEVEL: 'error',
    MAX_FILE_READ_BYTES: 1_048_576,
    MAX_SEARCH_RESULTS: 50,
    MAX_QUERY_ROWS: 100,
    REQUEST_BODY_LIMIT: 1_000_000,
    SESSION_TOKEN: undefined,
    LOCAL_AI_ENABLED: false,
    LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434',
    LOCAL_AI_MODEL: '',
    ALLOWED_ORIGINS:
      'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3847,http://localhost:3847',
    ALLOWED_HOSTS: undefined,
    ALLOW_NON_LOOPBACK: false,
    SERVE_WEB: false,
    LOG_RETENTION_DAYS: 30,
    projectRoot: workspace,
    workspaceAbsolute: workspace,
    databaseAbsolute: overrides.databaseAbsolute,
    webDistAbsolute: workspace,
    allowedOrigins: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3847',
      'http://localhost:3847',
    ],
    allowedHosts: [],
    allowedExtensions: ['.txt', '.md', '.json'],
    excludedDirectories: ['node_modules', '.git'],
    serveWeb: false,
    allowNonLoopback: false,
    ...overrides,
  };
}
