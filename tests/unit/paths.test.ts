import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PathSecurityError,
  resolveWorkspacePath,
  isContained,
} from '../../apps/server/src/security/paths.js';

describe('path security', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ws-'));
    fs.writeFileSync(path.join(root, 'ok.txt'), 'hello');
    fs.mkdirSync(path.join(root, 'sub'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolves relative paths inside workspace', () => {
    const resolved = resolveWorkspacePath(root, 'ok.txt');
    expect(resolved).toBe(path.resolve(root, 'ok.txt'));
  });

  it('rejects absolute paths', () => {
    expect(() => resolveWorkspacePath(root, path.resolve(root, 'ok.txt'))).toThrow(PathSecurityError);
  });

  it('rejects traversal', () => {
    expect(() => resolveWorkspacePath(root, '../outside.txt')).toThrow(PathSecurityError);
    expect(() => resolveWorkspacePath(root, 'sub/../../outside.txt')).toThrow(PathSecurityError);
  });

  it('isContained works', () => {
    expect(isContained(root, path.join(root, 'a'))).toBe(true);
    expect(isContained(root, path.join(root, '..', 'x'))).toBe(false);
  });

  it('rejects symlink escape when possible', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-out-'));
    const target = path.join(outside, 'secret.txt');
    fs.writeFileSync(target, 'secret');
    const link = path.join(root, 'escape');
    try {
      fs.symlinkSync(target, link);
    } catch {
      // Symlinks may require admin on Windows — skip
      fs.rmSync(outside, { recursive: true, force: true });
      return;
    }
    expect(() => resolveWorkspacePath(root, 'escape')).toThrow(PathSecurityError);
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
