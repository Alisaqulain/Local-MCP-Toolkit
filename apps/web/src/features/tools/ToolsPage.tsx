import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@/components/ui';
import { DynamicToolForm } from './DynamicToolForm';

export type ToolInfo = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: string;
  enabled: boolean;
  readOnly: boolean;
  permission: string;
  timeoutMs: number;
  lastExecutedAt?: string | null;
};

export function ToolsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingArgs, setPendingArgs] = useState<Record<string, unknown> | null>(null);

  const toolsQuery = useQuery({
    queryKey: ['tools'],
    queryFn: () => api<ToolInfo[]>('/api/tools'),
  });

  const tools = toolsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [tools, filter]);

  const active = tools.find((t) => t.name === selected) ?? filtered[0] ?? null;

  const execute = useMutation({
    mutationFn: async ({ name, args }: { name: string; args: Record<string, unknown> }) =>
      api<unknown>(`/api/tools/${encodeURIComponent(name)}/execute`, {
        method: 'POST',
        body: JSON.stringify({ arguments: args }),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Tool executed via MCP');
      void qc.invalidateQueries({ queryKey: ['overview'] });
      void qc.invalidateQueries({ queryKey: ['executions'] });
    },
    onError: (err: Error) => {
      setResult({ error: err.message });
      toast.error(err.message);
    },
  });

  function onSubmit(args: Record<string, unknown>) {
    if (!active) return;
    if (!active.readOnly) {
      setPendingArgs(args);
      setConfirmOpen(true);
      return;
    }
    execute.mutate({ name: active.name, args });
  }

  if (toolsQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (toolsQuery.error) {
    return (
      <EmptyState
        title="Could not discover MCP tools"
        description={toolsQuery.error instanceof Error ? toolsQuery.error.message : 'Error'}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="MCP Tools"
        description="Tools discovered through the MCP protocol. Execution uses the MCP client, not direct function calls."
      />

      <div className="mb-4">
        <Input
          placeholder="Filter tools…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter tools"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-fg-muted">No tools match.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(t.name);
                      setResult(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      active?.name === t.name ? 'bg-accent/15 text-accent' : 'hover:bg-bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-medium">{t.name}</span>
                      <Badge tone={t.readOnly ? 'neutral' : 'warning'}>
                        {t.readOnly ? 'read' : 'write'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{t.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {active ? (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-mono text-lg font-semibold">{active.name}</h2>
                    <p className="mt-1 text-sm text-fg-muted">{active.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="accent">{active.category}</Badge>
                    <Badge tone={active.enabled ? 'success' : 'danger'}>
                      {active.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-fg-muted">Input schema</summary>
                  <pre className="mt-2 overflow-auto rounded-lg bg-bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(active.inputSchema, null, 2)}
                  </pre>
                </details>
              </Card>

              <Card>
                <CardTitle>Arguments</CardTitle>
                <div className="mt-3">
                  <DynamicToolForm
                    schema={active.inputSchema}
                    onSubmit={onSubmit}
                    loading={execute.isPending}
                    disabled={!active.enabled}
                  />
                </div>
              </Card>

              <Card>
                <CardTitle>MCP result</CardTitle>
                {result == null ? (
                  <p className="mt-3 text-sm text-fg-muted">Run the tool to see the protocol response.</p>
                ) : (
                  <Textarea
                    className="mt-3 min-h-[220px]"
                    readOnly
                    value={JSON.stringify(result, null, 2)}
                  />
                )}
              </Card>
            </>
          ) : (
            <EmptyState title="Select a tool" description="Choose a tool from the list to inspect and execute." />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm write operation"
        message={`Tool "${active?.name}" may modify local data. Continue?`}
        confirmLabel="Execute"
        onCancel={() => {
          setConfirmOpen(false);
          setPendingArgs(null);
        }}
        onConfirm={() => {
          if (active && pendingArgs) {
            execute.mutate({ name: active.name, args: pendingArgs });
          }
          setConfirmOpen(false);
          setPendingArgs(null);
        }}
      />
    </div>
  );
}
