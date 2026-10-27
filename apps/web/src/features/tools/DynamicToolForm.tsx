import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui';

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema & { description?: string; default?: unknown }>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
};

export function DynamicToolForm({
  schema,
  onSubmit,
  loading,
  disabled,
}: {
  schema: Record<string, unknown>;
  onSubmit: (args: Record<string, unknown>) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const json = schema as JsonSchema;
  const properties = json.properties ?? {};
  const required = new Set(json.required ?? []);

  const initial = useMemo(() => {
    const vals: Record<string, string> = {};
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.default !== undefined) {
        vals[key] =
          typeof prop.default === 'string' ? prop.default : JSON.stringify(prop.default);
      } else if (propType(prop) === 'boolean') {
        vals[key] = 'false';
      } else if (propType(prop) === 'object' || propType(prop) === 'array') {
        vals[key] = propType(prop) === 'array' ? '[]' : '{}';
      } else {
        vals[key] = '';
      }
    }
    return vals;
  }, [schema]);

  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial);
    setError(null);
  }, [initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const args: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        const raw = values[key] ?? '';
        const t = propType(prop);
        if (raw === '' || raw === undefined) {
          if (required.has(key)) throw new Error(`Missing required field: ${key}`);
          continue;
        }
        args[key] = coerce(raw, t);
      }
      // If schema has no properties, allow empty object or parse raw JSON from a single field
      if (Object.keys(properties).length === 0 && values.__raw) {
        Object.assign(args, JSON.parse(values.__raw || '{}'));
      }
      onSubmit(args);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid input');
    }
  }

  const keys = Object.keys(properties);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {keys.length === 0 ? (
        <div>
          <label className="mb-1 block text-xs text-fg-muted">JSON arguments (optional)</label>
          <Textarea
            value={values.__raw ?? '{}'}
            onChange={(e) => setValues((v) => ({ ...v, __raw: e.target.value }))}
            rows={4}
          />
        </div>
      ) : (
        keys.map((key) => {
          const prop = properties[key];
          const t = propType(prop);
          return (
            <div key={key}>
              <label className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
                <span className="font-mono text-fg">{key}</span>
                {required.has(key) && <span className="text-danger">*</span>}
                <span className="opacity-70">({t})</span>
              </label>
              {prop.description && (
                <p className="mb-1 text-xs text-fg-muted">{prop.description}</p>
              )}
              {t === 'boolean' ? (
                <select
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : t === 'object' || t === 'array' || key === 'content' || key === 'sql' ? (
                <Textarea
                  rows={key === 'content' || key === 'sql' ? 6 : 3}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              ) : (
                <Input
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
              )}
            </div>
          );
        })
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" disabled={disabled || loading}>
        {loading ? 'Executing…' : 'Execute via MCP'}
      </Button>
    </form>
  );
}

function propType(prop: JsonSchema): string {
  const t = prop.type;
  if (Array.isArray(t)) return t[0] ?? 'string';
  return t ?? 'string';
}

function coerce(raw: string, type: string): unknown {
  if (type === 'number' || type === 'integer') {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Invalid number: ${raw}`);
    return type === 'integer' ? Math.trunc(n) : n;
  }
  if (type === 'boolean') return raw === 'true';
  if (type === 'object' || type === 'array') return JSON.parse(raw);
  return raw;
}
