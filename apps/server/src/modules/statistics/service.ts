import type { ExecutionRecord, OverviewStats, ToolStatus } from '@local-mcp/shared';
import { APP_VERSION } from '@local-mcp/shared';
import { getDatabase, checkDatabaseHealth } from '../../db/database.js';
import { getEnv } from '../../config/env.js';
import { getFileStats, getWorkspaceRoot } from '../filesystem/service.js';
import { listNotes } from '../notes/service.js';
import fs from 'node:fs';

const startedAt = new Date();

export function getStartedAt(): Date {
  return startedAt;
}

export function recordExecution(input: {
  toolName: string;
  category: string;
  inputSummary: string;
  status: ToolStatus;
  startedAt: string;
  durationMs: number;
  errorCategory?: string;
  errorMessage?: string;
  resultSummary?: string;
}): number {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO executions (tool_name, input_summary, status, started_at, duration_ms, error_category, error_message, result_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.toolName,
      input.inputSummary,
      input.status,
      input.startedAt,
      input.durationMs,
      input.errorCategory ?? null,
      input.errorMessage ?? null,
      input.resultSummary ?? null,
    );

  const successInc = input.status === 'success' ? 1 : 0;
  const failInc = input.status === 'error' ? 1 : 0;
  db.prepare(
    `INSERT INTO tool_stats (tool_name, category, success_count, failure_count, last_executed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tool_name) DO UPDATE SET
       success_count = success_count + excluded.success_count,
       failure_count = failure_count + excluded.failure_count,
       last_executed_at = excluded.last_executed_at,
       category = excluded.category`,
  ).run(input.toolName, input.category, successInc, failInc, input.startedAt);

  return Number(result.lastInsertRowid);
}

export function listExecutions(opts: {
  toolName?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): { records: ExecutionRecord[]; total: number } {
  const db = getDatabase();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.toolName) {
    where.push(`tool_name LIKE ?`);
    params.push(`%${opts.toolName}%`);
  }
  if (opts.status) {
    where.push(`status = ?`);
    params.push(opts.status);
  }
  if (opts.from) {
    where.push(`started_at >= ?`);
    params.push(opts.from);
  }
  if (opts.to) {
    where.push(`started_at <= ?`);
    params.push(opts.to);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sqlParams = params as (string | number)[];
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM executions ${clause}`).get(...sqlParams) as { c: number }
  ).c;
  const rows = db
    .prepare(
      `SELECT * FROM executions ${clause} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...sqlParams, limit, offset) as Array<{
    id: number;
    tool_name: string;
    input_summary: string;
    status: ToolStatus;
    started_at: string;
    duration_ms: number;
    error_category: string | null;
    error_message: string | null;
    result_summary: string | null;
  }>;
  return {
    total,
    records: rows.map((r) => ({
      id: r.id,
      toolName: r.tool_name,
      inputSummary: r.input_summary,
      status: r.status,
      startedAt: r.started_at,
      durationMs: r.duration_ms,
      errorCategory: r.error_category,
      errorMessage: r.error_message,
      resultSummary: r.result_summary,
    })),
  };
}

export function getExecution(id: number): ExecutionRecord | null {
  const db = getDatabase();
  const r = db.prepare(`SELECT * FROM executions WHERE id = ?`).get(id) as
    | {
        id: number;
        tool_name: string;
        input_summary: string;
        status: ToolStatus;
        started_at: string;
        duration_ms: number;
        error_category: string | null;
        error_message: string | null;
        result_summary: string | null;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    toolName: r.tool_name,
    inputSummary: r.input_summary,
    status: r.status,
    startedAt: r.started_at,
    durationMs: r.duration_ms,
    errorCategory: r.error_category,
    errorMessage: r.error_message,
    resultSummary: r.result_summary,
  };
}

export function clearExecutions(confirm: boolean): { deleted: number } {
  if (!confirm) throw new Error('Clearing history requires confirmation');
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM executions`).run();
  return { deleted: Number(result.changes) };
}

export function pruneExecutions(retentionDays: number): number {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  return Number(db.prepare(`DELETE FROM executions WHERE started_at < ?`).run(cutoff).changes);
}

export function getToolLastExecuted(toolName: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT last_executed_at FROM tool_stats WHERE tool_name = ?`)
    .get(toolName) as { last_executed_at: string | null } | undefined;
  return row?.last_executed_at ?? null;
}

export function getOverview(toolCount: number, mcpConnected: boolean): OverviewStats {
  const env = getEnv();
  const db = getDatabase();
  const success = (
    db.prepare(`SELECT COUNT(*) as c FROM executions WHERE status = 'success'`).get() as {
      c: number;
    }
  ).c;
  const failed = (
    db.prepare(`SELECT COUNT(*) as c FROM executions WHERE status = 'error'`).get() as {
      c: number;
    }
  ).c;
  const recentExecutions = listExecutions({ limit: 8 }).records;
  const recentNotes = listNotes({ limit: 5 }).notes;
  let workspaceStats;
  let workspaceAccessible = true;
  try {
    getWorkspaceRoot();
    workspaceStats = getFileStats({});
  } catch {
    workspaceAccessible = false;
    workspaceStats = {
      fileCount: 0,
      directoryCount: 0,
      totalBytes: 0,
      extensionCounts: {},
      truncated: false,
    };
  }

  const usageRows = db
    .prepare(
      `SELECT category, SUM(success_count + failure_count) as c FROM tool_stats GROUP BY category`,
    )
    .all() as Array<{ category: string; c: number }>;
  const toolUsageByCategory: Record<string, number> = {};
  for (const r of usageRows) {
    toolUsageByCategory[r.category] = r.c;
  }

  return {
    health: {
      status: checkDatabaseHealth() && workspaceAccessible ? 'ok' : 'degraded',
      uptimeMs: Date.now() - startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      mcpConnected,
      toolCount,
      databaseHealthy: checkDatabaseHealth(),
      workspacePath: env.WORKSPACE_PATH,
      workspaceAccessible,
      version: APP_VERSION,
    },
    successfulExecutions: success,
    failedExecutions: failed,
    recentExecutions,
    recentNotes,
    workspaceStats,
    toolUsageByCategory,
  };
}

export function redactInput(input: unknown): string {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  const redacted = str
    .replace(/(password|token|secret|api[_-]?key|authorization)\s*[:=]\s*["']?[^"',}\s]+/gi, '$1:[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]');
  return redacted.length > 500 ? redacted.slice(0, 500) + '…' : redacted;
}

export function summarizeResult(result: unknown): string {
  const str = typeof result === 'string' ? result : JSON.stringify(result);
  return str.length > 400 ? str.slice(0, 400) + '…' : str;
}

export function ensureSettingsDefaults(): void {
  const db = getDatabase();
  const existing = db.prepare(`SELECT key FROM settings WHERE key = 'app'`).get();
  if (!existing) {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('app', ?)`).run(
      JSON.stringify({
        theme: 'dark',
        maxFileReadBytes: getEnv().MAX_FILE_READ_BYTES,
        maxSearchResults: getEnv().MAX_SEARCH_RESULTS,
        allowedExtensions: getEnv().allowedExtensions,
        excludedDirectories: getEnv().excludedDirectories,
        logRetentionDays: getEnv().LOG_RETENTION_DAYS,
        localAiEnabled: false,
        localAiBaseUrl: 'http://127.0.0.1:11434',
        localAiModel: '',
        disabledTools: [],
      }),
    );
  }
}

export function getSettings() {
  const db = getDatabase();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'app'`).get() as
    | { value: string }
    | undefined;
  if (!row) {
    ensureSettingsDefaults();
    return getSettings();
  }
  return JSON.parse(row.value);
}

export function saveSettings(settings: Record<string, unknown>): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('app', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(settings));
}

export function exportExecutions(format: 'json' | 'csv', opts: Parameters<typeof listExecutions>[0]) {
  const { records } = listExecutions({ ...opts, limit: 5000, offset: 0 });
  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  }
  const header = 'id,toolName,status,startedAt,durationMs,errorCategory,errorMessage,inputSummary';
  const lines = records.map((r) =>
    [r.id, r.toolName, r.status, r.startedAt, r.durationMs, r.errorCategory ?? '', csvEscape(r.errorMessage ?? ''), csvEscape(r.inputSummary)]
      .join(','),
  );
  return [header, ...lines].join('\n');
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function workspaceExists(): boolean {
  try {
    return fs.existsSync(getEnv().workspaceAbsolute);
  } catch {
    return false;
  }
}
