import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS, SCHEMA_VERSION } from './schema.js';
import { logger } from '../logging/logger.js';

export type AppDatabase = DatabaseSync;

let db: AppDatabase | null = null;

export function openDatabase(dbPath: string): AppDatabase {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

export function openMemoryDatabase(): AppDatabase {
  const mem = new DatabaseSync(':memory:');
  mem.exec('PRAGMA foreign_keys = ON');
  migrate(mem);
  return mem;
}

export function getDatabase(): AppDatabase {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function setDatabase(database: AppDatabase): void {
  db = database;
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

export function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = database.prepare(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  let current = row ? Number(row.value) : 0;

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      logger.info({ version: m.version }, 'Applying database migration');
      try {
        database.exec(m.sql);
      } catch (err) {
        // FTS5 may be unavailable in some builds — fall back without FTS
        const message = err instanceof Error ? err.message : String(err);
        if (/fts5|virtual table/i.test(message)) {
          logger.warn('FTS5 unavailable; applying schema without full-text search');
          database.exec(migrationWithoutFts(m.sql));
        } else {
          throw err;
        }
      }
      database
        .prepare(
          `INSERT INTO schema_meta(key, value) VALUES(?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run('schema_version', String(m.version));
      current = m.version;
    }
  }

  if (current < SCHEMA_VERSION) {
    database
      .prepare(
        `INSERT INTO schema_meta(key, value) VALUES(?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run('schema_version', String(SCHEMA_VERSION));
  }
}

function migrationWithoutFts(sql: string): string {
  return sql
    .replace(/CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts[\s\S]*?;/i, '')
    .replace(/CREATE TRIGGER IF NOT EXISTS notes_ai[\s\S]*?END;/gi, '')
    .replace(/CREATE TRIGGER IF NOT EXISTS notes_ad[\s\S]*?END;/gi, '')
    .replace(/CREATE TRIGGER IF NOT EXISTS notes_au[\s\S]*?END;/gi, '');
}

export function getSchemaVersion(database = getDatabase()): number {
  const row = database.prepare(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

export function checkDatabaseHealth(database = getDatabase()): boolean {
  try {
    database.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}

export function openReadonlyDatabase(dbPath: string): AppDatabase | null {
  try {
    return new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return null;
  }
}
