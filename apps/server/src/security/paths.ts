import fs from 'node:fs';
import path from 'node:path';

export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Resolve a workspace-relative path safely.
 * Rejects absolute paths, traversal, and symlink escapes.
 */
export function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string | undefined | null,
  options: { mustExist?: boolean } = {},
): string {
  const root = path.resolve(workspaceRoot);
  const input = relativePath == null || relativePath === '' ? '.' : relativePath;

  if (path.isAbsolute(input)) {
    throw new PathSecurityError('Absolute paths are not allowed');
  }

  if (input.includes('\0') || /^[a-zA-Z]:/.test(input)) {
    throw new PathSecurityError('Invalid path characters');
  }

  const posixified = input.replace(/\\/g, '/');
  const segments = posixified.split('/').filter((s) => s.length > 0);
  if (segments.some((s) => s === '..')) {
    throw new PathSecurityError('Path traversal is not allowed');
  }

  const normalized = path.normalize(input);
  // Defense in depth after platform normalize
  const normSegs = normalized.split(/[/\\]/).filter(Boolean);
  if (normSegs.some((s) => s === '..')) {
    throw new PathSecurityError('Path traversal is not allowed');
  }

  const candidate = path.resolve(root, normalized);

  if (!isContained(root, candidate)) {
    throw new PathSecurityError('Path escapes the workspace');
  }

  if (fs.existsSync(candidate)) {
    let realCandidate: string;
    let realRoot: string;
    try {
      realCandidate = fs.realpathSync(candidate);
      realRoot = fs.realpathSync(root);
    } catch {
      throw new PathSecurityError('Unable to resolve real path');
    }
    if (!isContained(realRoot, realCandidate)) {
      throw new PathSecurityError('Symlink escapes the workspace');
    }
    return realCandidate;
  }

  if (options.mustExist) {
    throw new PathSecurityError('Path does not exist');
  }

  const parent = path.dirname(candidate);
  if (!isContained(root, parent)) {
    throw new PathSecurityError('Parent path escapes the workspace');
  }
  if (fs.existsSync(parent)) {
    const realParent = fs.realpathSync(parent);
    const realRoot = fs.realpathSync(root);
    if (!isContained(realRoot, realParent)) {
      throw new PathSecurityError('Parent symlink escapes the workspace');
    }
  }

  return candidate;
}

export function isContained(root: string, target: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  if (r === t) return true;
  const prefix = r.endsWith(path.sep) ? r : r + path.sep;
  return t.startsWith(prefix);
}

export function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  const root = path.resolve(workspaceRoot);
  const abs = path.resolve(absolutePath);
  if (!isContained(root, abs)) {
    throw new PathSecurityError('Path is outside workspace');
  }
  const rel = path.relative(root, abs);
  return rel === '' ? '.' : rel.split(path.sep).join('/');
}

export function ensureWorkspaceExists(workspaceRoot: string): void {
  fs.mkdirSync(workspaceRoot, { recursive: true });
}
