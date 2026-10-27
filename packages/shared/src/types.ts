import type { ToolCategory } from './constants.js';

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface ApiSuccess<T> {
  data: T;
  requestId?: string;
}

export type ToolStatus = 'success' | 'error' | 'cancelled';

export interface ToolMeta {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
  readOnly: boolean;
  permission: 'read' | 'write' | 'admin';
  timeoutMs: number;
  lastExecutedAt?: string | null;
}

export interface ExecutionRecord {
  id: number;
  toolName: string;
  inputSummary: string;
  status: ToolStatus;
  startedAt: string;
  durationMs: number;
  errorCategory?: string | null;
  errorMessage?: string | null;
  resultSummary?: string | null;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

export interface WorkspaceStats {
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  extensionCounts: Record<string, number>;
  truncated: boolean;
}

export interface ServerHealth {
  status: 'ok' | 'degraded' | 'error';
  uptimeMs: number;
  startedAt: string;
  mcpConnected: boolean;
  toolCount: number;
  databaseHealthy: boolean;
  workspacePath: string;
  workspaceAccessible: boolean;
  version: string;
}

export interface OverviewStats {
  health: ServerHealth;
  successfulExecutions: number;
  failedExecutions: number;
  recentExecutions: ExecutionRecord[];
  recentNotes: Note[];
  workspaceStats: WorkspaceStats;
  toolUsageByCategory: Record<string, number>;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  maxFileReadBytes: number;
  maxSearchResults: number;
  allowedExtensions: string[];
  excludedDirectories: string[];
  logRetentionDays: number;
  localAiEnabled: boolean;
  localAiBaseUrl: string;
  localAiModel: string;
  disabledTools: string[];
}

export interface DatabaseInfo {
  path: string;
  schemaVersion: number;
  tables: string[];
  healthy: boolean;
  sizeBytes: number;
}

export interface TableInfo {
  name: string;
  columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  rowCount: number;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}
