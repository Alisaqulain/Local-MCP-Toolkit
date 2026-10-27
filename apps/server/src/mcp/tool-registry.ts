import type { ToolCategory } from '@local-mcp/shared';
import { DEFAULT_TOOL_TIMEOUT_MS } from '@local-mcp/shared';
import { getSettings, getToolLastExecuted } from '../modules/statistics/service.js';

export interface RegisteredToolMeta {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  permission: 'read' | 'write' | 'admin';
  timeoutMs: number;
  enabled: boolean;
}

const registry = new Map<string, RegisteredToolMeta>();

export function registerToolMeta(meta: Omit<RegisteredToolMeta, 'enabled'> & { enabled?: boolean }): void {
  registry.set(meta.name, {
    ...meta,
    enabled: meta.enabled ?? true,
    timeoutMs: meta.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
  });
}

export function getToolMeta(name: string): RegisteredToolMeta | undefined {
  return registry.get(name);
}

export function listToolMeta(): RegisteredToolMeta[] {
  let disabled: string[] = [];
  try {
    const settings = getSettings();
    disabled = settings.disabledTools ?? [];
  } catch {
    disabled = [];
  }

  return Array.from(registry.values()).map((t) => ({
    ...t,
    enabled: t.enabled && !disabled.includes(t.name),
    lastExecutedAt: getToolLastExecuted(t.name),
  })) as RegisteredToolMeta[];
}

export function isToolEnabled(name: string): boolean {
  const meta = registry.get(name);
  if (!meta || !meta.enabled) return false;
  try {
    const settings = getSettings();
    return !(settings.disabledTools ?? []).includes(name);
  } catch {
    return meta.enabled;
  }
}

export function getRegistrySize(): number {
  return registry.size;
}

export function clearRegistry(): void {
  registry.clear();
}
