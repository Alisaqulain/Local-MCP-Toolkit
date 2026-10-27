import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { openDatabase, setDatabase, closeDatabase } from '../../apps/server/src/db/database.js';
import { setEnvForTests, type Env } from '../../apps/server/src/config/env.js';
import * as dbService from '../../apps/server/src/modules/database/service.js';
import * as notes from '../../apps/server/src/modules/notes/service.js';

describe('database query tool safety', () => {
  let dbPath: string;

  beforeEach(() => {
    closeDatabase();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-db-'));
    dbPath = path.join(dir, 'test.sqlite');
    const env = {
      HOST: '127.0.0.1',
      PORT: 3847,
      WEB_ORIGIN: 'http://127.0.0.1:5173',
      WORKSPACE_PATH: dir,
      DATABASE_PATH: dbPath,
      LOG_LEVEL: 'error' as const,
      MAX_FILE_READ_BYTES: 1024,
      MAX_SEARCH_RESULTS: 50,
      MAX_QUERY_ROWS: 10,
      REQUEST_BODY_LIMIT: 1_000_000,
      LOCAL_AI_ENABLED: false,
      LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434',
      LOCAL_AI_MODEL: '',
      ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
      LOG_RETENTION_DAYS: 30,
      workspaceAbsolute: dir,
      databaseAbsolute: dbPath,
      allowedOrigins: ['http://127.0.0.1:5173'],
      allowedExtensions: ['.txt'],
      excludedDirectories: ['node_modules'],
      projectRoot: dir,
    } satisfies Env;
    setEnvForTests(env);
    setDatabase(openDatabase(dbPath));
    notes.createNote({ title: 'T', content: 'C' });
  });

  it('runs SELECT', () => {
    const r = dbService.queryDatabase('SELECT title FROM notes');
    expect(r.rowCount).toBeGreaterThan(0);
  });

  it('rejects DELETE', () => {
    expect(() => dbService.queryDatabase('DELETE FROM notes')).toThrow();
  });

  it('lists tables', () => {
    const tables = dbService.listDatabaseTables();
    expect(tables).toContain('notes');
  });
});
