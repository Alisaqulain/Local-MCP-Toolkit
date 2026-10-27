import { beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { openDatabase, setDatabase, closeDatabase } from '../../apps/server/src/db/database.js';
import { setEnvForTests } from '../../apps/server/src/config/env.js';
import * as dbService from '../../apps/server/src/modules/database/service.js';
import * as notes from '../../apps/server/src/modules/notes/service.js';
import { testEnv } from '../helpers/env.js';

describe('database query tool safety', () => {
  let dbPath: string;

  beforeEach(() => {
    closeDatabase();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-db-'));
    dbPath = path.join(dir, 'test.sqlite');
    setEnvForTests(
      testEnv({
        workspaceAbsolute: dir,
        databaseAbsolute: dbPath,
        MAX_FILE_READ_BYTES: 1024,
        MAX_QUERY_ROWS: 10,
        allowedExtensions: ['.txt'],
      }),
    );
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
