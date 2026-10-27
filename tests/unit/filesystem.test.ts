import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setEnvForTests, type Env } from '../../apps/server/src/config/env.js';
import * as fsService from '../../apps/server/src/modules/filesystem/service.js';

function fakeEnv(workspace: string): Env {
  return {
    HOST: '127.0.0.1',
    PORT: 3847,
    WEB_ORIGIN: 'http://127.0.0.1:5173',
    WORKSPACE_PATH: workspace,
    DATABASE_PATH: ':memory:',
    LOG_LEVEL: 'error',
    MAX_FILE_READ_BYTES: 1024 * 64,
    MAX_SEARCH_RESULTS: 50,
    MAX_QUERY_ROWS: 100,
    REQUEST_BODY_LIMIT: 1_000_000,
    LOCAL_AI_ENABLED: false,
    LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434',
    LOCAL_AI_MODEL: '',
    ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    LOG_RETENTION_DAYS: 30,
    workspaceAbsolute: workspace,
    databaseAbsolute: ':memory:',
    allowedOrigins: ['http://127.0.0.1:5173'],
    allowedExtensions: ['.txt', '.md', '.json'],
    excludedDirectories: ['node_modules', '.git'],
    projectRoot: workspace,
  };
}

describe('filesystem service', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-fs-'));
    setEnvForTests(fakeEnv(root));
    fs.writeFileSync(path.join(root, 'a.txt'), 'alpha content');
    fs.mkdirSync(path.join(root, 'dir'));
    fs.writeFileSync(path.join(root, 'dir', 'b.md'), 'beta markdown');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists files', () => {
    const { entries } = fsService.listFiles({ path: '.', recursive: true });
    expect(entries.some((e) => e.name === 'a.txt')).toBe(true);
    expect(entries.some((e) => e.name === 'b.md')).toBe(true);
  });

  it('reads files', () => {
    const r = fsService.readFileSafe({ path: 'a.txt' });
    expect(r.content).toContain('alpha');
  });

  it('refuses overwrite on create', () => {
    expect(() => fsService.createFileSafe({ path: 'a.txt', content: 'x' })).toThrow(/exists/);
  });

  it('creates new files', () => {
    const r = fsService.createFileSafe({ path: 'new.txt', content: 'hi' });
    expect(r.created).toBe(true);
    expect(fs.readFileSync(path.join(root, 'new.txt'), 'utf8')).toBe('hi');
  });

  it('searches content', () => {
    const r = fsService.searchFiles({ query: 'beta', searchContent: true });
    expect(r.results.some((x) => x.matchType === 'content')).toBe(true);
  });

  it('rejects traversal on read', () => {
    expect(() => fsService.readFileSafe({ path: '../secret.txt' })).toThrow();
  });
});
