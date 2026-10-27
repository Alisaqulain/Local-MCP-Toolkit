import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDuration, formatRelative } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui';
import type { ExecutionRecord } from '@local-mcp/shared';

export function LogsPage() {
  const qc = useQueryClient();
  const [toolName, setToolName] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ExecutionRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  const list = useQuery({
    queryKey: ['executions', toolName, status, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (toolName) params.set('toolName', toolName);
      if (status) params.set('status', status);
      return api<{ records: ExecutionRecord[]; total: number }>(`/api/executions?${params}`);
    },
  });

  const clear = useMutation({
    mutationFn: () =>
      api('/api/executions', { method: 'DELETE', body: JSON.stringify({ confirm: true }) }),
    onSuccess: () => {
      toast.success('History cleared');
      setConfirmClear(false);
      void qc.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  async function exportHistory(format: 'json' | 'csv') {
    const token = localStorage.getItem('local-mcp-session-token');
    const params = new URLSearchParams({ format });
    if (toolName) params.set('toolName', toolName);
    if (status) params.set('status', status);
    const res = await fetch(`/api/executions/export?${params}`, {
      headers: { 'X-Session-Token': token ?? '' },
    });
    const text = await res.text();
    const blob = new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <PageHeader
        title="Execution History"
        description="Persisted MCP tool runs with redacted inputs and sanitized errors."
        actions={
          <>
            <Button size="sm" onClick={() => void exportHistory('json')}>
              Export JSON
            </Button>
            <Button size="sm" onClick={() => void exportHistory('csv')}>
              Export CSV
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmClear(true)}>
              Clear
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Filter by tool…"
          value={toolName}
          onChange={(e) => {
            setToolName(e.target.value);
            setPage(0);
          }}
          className="max-w-xs"
        />
        <select
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="error">error</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (list.data?.records.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState title="No executions yet" description="Run a tool from the MCP Tools page." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.data!.records.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-bg-muted/50"
                    onClick={() => setSelected(r)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-medium">{r.toolName}</p>
                      <p className="text-xs text-fg-muted">
                        {formatRelative(r.startedAt)} · {formatDuration(r.durationMs)}
                      </p>
                    </div>
                    <Badge tone={r.status === 'success' ? 'success' : 'danger'}>{r.status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
            <span className="text-fg-muted">
              {total} total · page {page + 1}/{pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          {!selected ? (
            <EmptyState title="Select a record" />
          ) : (
            <dl className="space-y-3 text-sm">
              <Item label="Tool" value={selected.toolName} />
              <Item label="Status" value={selected.status} />
              <Item label="Started" value={new Date(selected.startedAt).toLocaleString()} />
              <Item label="Duration" value={formatDuration(selected.durationMs)} />
              <Item label="Input summary" value={selected.inputSummary} mono />
              <Item label="Result summary" value={selected.resultSummary || '—'} mono />
              <Item label="Error category" value={selected.errorCategory || '—'} />
              <Item label="Error message" value={selected.errorMessage || '—'} />
            </dl>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear execution history?"
        message="This deletes all persisted execution records from SQLite."
        confirmLabel="Clear history"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={`mt-1 break-words ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
