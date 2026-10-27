import fs from 'node:fs';
import type { DatabaseInfo, QueryResult, TableInfo } from '@local-mcp/shared';
import {
  getDatabase,
  getSchemaVersion,
  checkDatabaseHealth,
  openReadonlyDatabase,
} from '../../db/database.js';
import { getEnv } from '../../config/env.js';
import { validateReadOnlySelect } from '../../security/sql.js';

const APP_TABLES = new Set([
  'schema_meta',
  'notes',
  'notes_fts',
  'notes_fts_data',
  'notes_fts_idx',
  'notes_fts_content',
  'notes_fts_docsize',
  'notes_fts_config',
  'executions',
  'settings',
  'tool_stats',
  'sqlite_sequence',
]);

export function getDatabaseInfo(): DatabaseInfo {
  const env = getEnv();
  const db = getDatabase();
  const tables = listUserTables();
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(env.databaseAbsolute).size;
  } catch {
    sizeBytes = 0;
  }
  return {
    path: env.DATABASE_PATH,
    schemaVersion: getSchemaVersion(db),
    tables,
    healthy: checkDatabaseHealth(db),
    sizeBytes,
  };
}

export function listUserTables(): string[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'notes_fts%' ORDER BY name`,
    )
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export function listDatabaseTables(): string[] {
  return listUserTables();
}

export function getTableInfo(tableName: string): TableInfo {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error('Invalid table name');
  }
  const allowed = listUserTables();
  if (!allowed.includes(tableName)) {
    throw new Error('Table not found or not accessible');
  }
  const db = getDatabase();
  const columns = db.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all() as Array<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>;
  const rowCount = (
    db.prepare(`SELECT COUNT(*) as c FROM ${quoteIdent(tableName)}`).get() as { c: number }
  ).c;
  return {
    name: tableName,
    columns: columns.map((c) => ({
      name: c.name,
      type: c.type || 'ANY',
      notnull: !!c.notnull,
      pk: !!c.pk,
    })),
    rowCount,
  };
}

export function browseTable(
  tableName: string,
  opts: { limit?: number; offset?: number } = {},
): QueryResult {
  const info = getTableInfo(tableName);
  const env = getEnv();
  const limit = Math.min(opts.limit ?? 50, env.MAX_QUERY_ROWS);
  const offset = opts.offset ?? 0;
  const db = getDatabase();
  const started = Date.now();
  const rowsRaw = db
    .prepare(`SELECT * FROM ${quoteIdent(tableName)} LIMIT ? OFFSET ?`)
    .all(limit, offset) as Record<string, unknown>[];
  const columns = info.columns.map((c) => c.name);
  const rows = rowsRaw.map((r) => columns.map((c) => sanitizeCell(r[c])));
  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated: rows.length >= limit,
    durationMs: Date.now() - started,
  };
}

export function queryDatabase(sql: string, limit?: number): QueryResult {
  const validation = validateReadOnlySelect(sql);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  const env = getEnv();
  const maxRows = Math.min(limit ?? env.MAX_QUERY_ROWS, env.MAX_QUERY_ROWS);

  const readonlyDb = openReadonlyDatabase(env.databaseAbsolute);
  const db = readonlyDb ?? getDatabase();
  const started = Date.now();
  try {
    const stmt = db.prepare(sql);
    const raw = stmt.all() as Record<string, unknown>[];
    const truncated = raw.length > maxRows;
    const sliced = truncated ? raw.slice(0, maxRows) : raw;
    const columns = sliced.length > 0 ? Object.keys(sliced[0]!) : extractColumns(sql);
    const rows = sliced.map((r) => columns.map((c) => sanitizeCell(r[c])));
    return {
      columns,
      rows,
      rowCount: rows.length,
      truncated,
      durationMs: Date.now() - started,
    };
  } finally {
    if (readonlyDb) {
      try {
        readonlyDb.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sanitizeCell(value: unknown): unknown {
  if (typeof value === 'string' && value.length > 2000) {
    return value.slice(0, 2000) + '…';
  }
  return value;
}

function extractColumns(_sql: string): string[] {
  return [];
}

export function isAppTable(name: string): boolean {
  return APP_TABLES.has(name) || listUserTables().includes(name);
}
