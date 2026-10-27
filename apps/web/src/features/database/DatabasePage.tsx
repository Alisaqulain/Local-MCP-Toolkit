import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  Spinner,
  Textarea,
} from '@/components/ui';
import type { DatabaseInfo, QueryResult, TableInfo } from '@local-mcp/shared';

export function DatabasePage() {
  const [table, setTable] = useState<string | null>(null);
  const [sql, setSql] = useState('SELECT id, title, created_at FROM notes LIMIT 20');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const info = useQuery({
    queryKey: ['db-info'],
    queryFn: () => api<DatabaseInfo>('/api/database/info'),
  });

  const tableInfo = useQuery({
    queryKey: ['db-table', table],
    queryFn: () => api<TableInfo>(`/api/database/tables/${encodeURIComponent(table!)}`),
    enabled: !!table,
  });

  const rows = useQuery({
    queryKey: ['db-rows', table],
    queryFn: () =>
      api<QueryResult>(`/api/database/tables/${encodeURIComponent(table!)}/rows?limit=50`),
    enabled: !!table,
  });

  const runQuery = useMutation({
    mutationFn: () =>
      api<QueryResult>('/api/database/query', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      }),
    onSuccess: (data) => {
      setQueryResult(data);
      toast.success(`Query OK · ${data.rowCount} rows · ${formatDuration(data.durationMs)}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Database Explorer"
        description="Read-only inspection of the application SQLite database. Writes and multi-statements are rejected server-side."
      />

      {info.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : info.data ? (
        <Card className="mb-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-fg-muted">Path</p>
              <p className="font-mono">{info.data.path}</p>
            </div>
            <div>
              <p className="text-fg-muted">Schema</p>
              <p>v{info.data.schemaVersion}</p>
            </div>
            <div>
              <p className="text-fg-muted">Size</p>
              <p>{formatBytes(info.data.sizeBytes)}</p>
            </div>
            <div>
              <p className="text-fg-muted">Health</p>
              <Badge tone={info.data.healthy ? 'success' : 'danger'}>
                {info.data.healthy ? 'healthy' : 'unhealthy'}
              </Badge>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="p-2">
          <CardTitle className="px-2 pt-2">Tables</CardTitle>
          <ul className="mt-2 space-y-1">
            {(info.data?.tables ?? []).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    table === t ? 'bg-accent/15 text-accent' : 'hover:bg-bg-muted'
                  }`}
                  onClick={() => setTable(t)}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          {table ? (
            <Card>
              <CardTitle>{table}</CardTitle>
              {tableInfo.data && (
                <div className="mt-3 overflow-auto">
                  <p className="mb-2 text-sm text-fg-muted">{tableInfo.data.rowCount} rows</p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-fg-muted">
                        <th className="py-1 pr-3">Column</th>
                        <th className="py-1 pr-3">Type</th>
                        <th className="py-1">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableInfo.data.columns.map((c) => (
                        <tr key={c.name} className="border-b border-border/50">
                          <td className="py-1 pr-3 font-mono text-xs">{c.name}</td>
                          <td className="py-1 pr-3">{c.type}</td>
                          <td className="py-1 text-xs text-fg-muted">
                            {[c.pk && 'PK', c.notnull && 'NOT NULL'].filter(Boolean).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.data && <ResultTable result={rows.data} />}
            </Card>
          ) : (
            <EmptyState title="Select a table" description="Browse schema and sample rows." />
          )}

          <Card>
            <CardTitle>Read-only query editor</CardTitle>
            <Textarea className="mt-3 min-h-[120px]" value={sql} onChange={(e) => setSql(e.target.value)} />
            <div className="mt-3">
              <Button variant="primary" size="sm" disabled={runQuery.isPending} onClick={() => runQuery.mutate()}>
                {runQuery.isPending ? 'Running…' : 'Run SELECT'}
              </Button>
            </div>
            {queryResult && <ResultTable result={queryResult} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  return (
    <div className="mt-4 overflow-auto">
      <p className="mb-2 text-xs text-fg-muted">
        {result.rowCount} rows · {formatDuration(result.durationMs)}
        {result.truncated ? ' · truncated' : ''}
      </p>
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="border-b border-border text-fg-muted">
            {result.columns.map((c) => (
              <th key={c} className="px-2 py-1 font-mono">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40">
              {row.map((cell, j) => (
                <td key={j} className="max-w-[240px] truncate px-2 py-1 font-mono">
                  {cell == null ? 'NULL' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
