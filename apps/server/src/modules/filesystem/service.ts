import fs from 'node:fs';
import path from 'node:path';
import type { FileEntry, WorkspaceStats } from '@local-mcp/shared';
import { getEnv } from '../../config/env.js';
import {
  ensureWorkspaceExists,
  PathSecurityError,
  resolveWorkspacePath,
  toWorkspaceRelative,
} from '../../security/paths.js';

const TEXT_SAMPLE_SIZE = 8192;

export function getWorkspaceRoot(): string {
  const env = getEnv();
  ensureWorkspaceExists(env.workspaceAbsolute);
  return env.workspaceAbsolute;
}

export function listFiles(opts: {
  path?: string;
  recursive?: boolean;
  limit?: number;
}): { entries: FileEntry[]; truncated: boolean } {
  const env = getEnv();
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path ?? '.');
  const limit = Math.min(opts.limit ?? 500, 2000);
  const entries: FileEntry[] = [];
  let truncated = false;

  const walk = (dir: string, depth: number) => {
    if (entries.length >= limit) {
      truncated = true;
      return;
    }
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (entries.length >= limit) {
        truncated = true;
        return;
      }
      if (item.isDirectory() && env.excludedDirectories.includes(item.name)) {
        continue;
      }
      const full = path.join(dir, item.name);
      // Skip symlinks that escape
      try {
        resolveWorkspacePath(root, toWorkspaceRelative(root, full));
      } catch {
        continue;
      }
      const rel = toWorkspaceRelative(root, full);
      const stat = safeStat(full);
      const entry: FileEntry = {
        name: item.name,
        path: rel,
        type: item.isDirectory() ? 'directory' : 'file',
        size: item.isFile() ? stat?.size : undefined,
        modifiedAt: stat ? new Date(stat.mtimeMs).toISOString() : undefined,
        extension: item.isFile() ? path.extname(item.name).toLowerCase() : undefined,
      };
      entries.push(entry);
      if (opts.recursive && item.isDirectory() && depth < 20) {
        walk(full, depth + 1);
      }
    }
  };

  const st = fs.statSync(abs);
  if (st.isFile()) {
    const rel = toWorkspaceRelative(root, abs);
    return {
      entries: [
        {
          name: path.basename(abs),
          path: rel,
          type: 'file',
          size: st.size,
          modifiedAt: new Date(st.mtimeMs).toISOString(),
          extension: path.extname(abs).toLowerCase(),
        },
      ],
      truncated: false,
    };
  }

  walk(abs, 0);
  return { entries, truncated };
}

export function readFileSafe(opts: {
  path: string;
  maxBytes?: number;
}): { content: string; path: string; size: number; truncated: boolean; encoding: string } {
  const env = getEnv();
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path, { mustExist: true });
  const st = fs.statSync(abs);
  if (!st.isFile()) {
    throw new PathSecurityError('Path is not a file');
  }
  const maxBytes = Math.min(opts.maxBytes ?? env.MAX_FILE_READ_BYTES, env.MAX_FILE_READ_BYTES);
  if (st.size > maxBytes * 2) {
    throw new Error(`File too large (${st.size} bytes). Max allowed read is ${maxBytes} bytes.`);
  }
  const buf = fs.readFileSync(abs);
  if (isBinaryBuffer(buf)) {
    throw new Error('Binary files cannot be read as text');
  }
  const truncated = buf.length > maxBytes;
  const slice = truncated ? buf.subarray(0, maxBytes) : buf;
  return {
    content: slice.toString('utf8'),
    path: toWorkspaceRelative(root, abs),
    size: st.size,
    truncated,
    encoding: 'utf8',
  };
}

export function createFileSafe(opts: { path: string; content: string }): {
  path: string;
  size: number;
  created: boolean;
} {
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path);
  if (fs.existsSync(abs)) {
    throw new Error('File already exists; refusing to overwrite');
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  // Re-check after mkdir (TOCTOU)
  if (fs.existsSync(abs)) {
    throw new Error('File already exists; refusing to overwrite');
  }
  const fd = fs.openSync(abs, 'wx');
  try {
    fs.writeFileSync(fd, opts.content, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
  const st = fs.statSync(abs);
  return { path: toWorkspaceRelative(root, abs), size: st.size, created: true };
}

export function createDirectorySafe(opts: { path: string }): { path: string; created: boolean } {
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path);
  if (fs.existsSync(abs)) {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      return { path: toWorkspaceRelative(root, abs), created: false };
    }
    throw new Error('A file already exists at this path');
  }
  fs.mkdirSync(abs, { recursive: true });
  return { path: toWorkspaceRelative(root, abs), created: true };
}

export function getFileMetadata(opts: { path: string }) {
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path, { mustExist: true });
  const st = fs.statSync(abs);
  return {
    path: toWorkspaceRelative(root, abs),
    name: path.basename(abs),
    type: st.isDirectory() ? 'directory' : 'file',
    size: st.size,
    extension: st.isFile() ? path.extname(abs).toLowerCase() : undefined,
    createdAt: new Date(st.birthtimeMs).toISOString(),
    modifiedAt: new Date(st.mtimeMs).toISOString(),
    accessedAt: new Date(st.atimeMs).toISOString(),
  };
}

export function getFileStats(opts: { path?: string } = {}): WorkspaceStats {
  const env = getEnv();
  const root = getWorkspaceRoot();
  const abs = resolveWorkspacePath(root, opts.path ?? '.');
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  let truncated = false;
  const extensionCounts: Record<string, number> = {};
  const maxEntries = 10_000;

  const walk = (dir: string, depth: number) => {
    if (fileCount + directoryCount >= maxEntries || depth > 25) {
      truncated = true;
      return;
    }
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (fileCount + directoryCount >= maxEntries) {
        truncated = true;
        return;
      }
      if (item.isDirectory() && env.excludedDirectories.includes(item.name)) continue;
      const full = path.join(dir, item.name);
      try {
        resolveWorkspacePath(root, toWorkspaceRelative(root, full));
      } catch {
        continue;
      }
      if (item.isDirectory()) {
        directoryCount++;
        walk(full, depth + 1);
      } else if (item.isFile()) {
        fileCount++;
        const st = safeStat(full);
        if (st) totalBytes += st.size;
        const ext = path.extname(item.name).toLowerCase() || '(none)';
        extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
      }
    }
  };

  const st = fs.statSync(abs);
  if (st.isFile()) {
    return {
      fileCount: 1,
      directoryCount: 0,
      totalBytes: st.size,
      extensionCounts: { [path.extname(abs).toLowerCase() || '(none)']: 1 },
      truncated: false,
    };
  }
  walk(abs, 0);
  return { fileCount, directoryCount, totalBytes, extensionCounts, truncated };
}

export function searchFiles(opts: {
  query: string;
  path?: string;
  searchContent?: boolean;
  extensions?: string[];
  limit?: number;
}): { results: Array<FileEntry & { matchType: 'name' | 'content'; snippet?: string }>; truncated: boolean } {
  const env = getEnv();
  const root = getWorkspaceRoot();
  const start = resolveWorkspacePath(root, opts.path ?? '.');
  const limit = Math.min(opts.limit ?? env.MAX_SEARCH_RESULTS, env.MAX_SEARCH_RESULTS);
  const query = opts.query.toLowerCase();
  const allowedExts = opts.extensions?.map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`));
  const results: Array<FileEntry & { matchType: 'name' | 'content'; snippet?: string }> = [];
  let truncated = false;
  let scanned = 0;
  const maxScan = 5000;

  const walk = (dir: string, depth: number) => {
    if (results.length >= limit || scanned >= maxScan || depth > 20) {
      if (scanned >= maxScan || depth > 20) truncated = true;
      return;
    }
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (results.length >= limit || scanned >= maxScan) {
        truncated = true;
        return;
      }
      if (item.isDirectory() && env.excludedDirectories.includes(item.name)) continue;
      const full = path.join(dir, item.name);
      try {
        resolveWorkspacePath(root, toWorkspaceRelative(root, full));
      } catch {
        continue;
      }
      if (item.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      scanned++;
      const ext = path.extname(item.name).toLowerCase();
      if (allowedExts && !allowedExts.includes(ext)) continue;
      const st = safeStat(full);
      const rel = toWorkspaceRelative(root, full);
      const base: FileEntry = {
        name: item.name,
        path: rel,
        type: 'file',
        size: st?.size,
        modifiedAt: st ? new Date(st.mtimeMs).toISOString() : undefined,
        extension: ext,
      };
      if (item.name.toLowerCase().includes(query)) {
        results.push({ ...base, matchType: 'name' });
        continue;
      }
      if (opts.searchContent && st && st.size <= env.MAX_FILE_READ_BYTES) {
        try {
          const buf = fs.readFileSync(full);
          if (isBinaryBuffer(buf)) continue;
          const text = buf.toString('utf8');
          const idx = text.toLowerCase().indexOf(query);
          if (idx >= 0) {
            const startIdx = Math.max(0, idx - 40);
            const endIdx = Math.min(text.length, idx + query.length + 40);
            results.push({
              ...base,
              matchType: 'content',
              snippet: text.slice(startIdx, endIdx).replace(/\s+/g, ' '),
            });
          }
        } catch {
          /* skip unreadable */
        }
      }
    }
  };

  walk(start, 0);
  return { results, truncated };
}

function safeStat(p: string): fs.Stats | null {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

export function isBinaryBuffer(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, TEXT_SAMPLE_SIZE));
  if (sample.includes(0)) return true;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) suspicious++;
  }
  return suspicious / sample.length > 0.3;
}
