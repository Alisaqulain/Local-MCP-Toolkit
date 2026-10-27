import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { Badge, Card, CardTitle, PageHeader, Spinner } from '@/components/ui';

export function StatusPage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<any>('/api/health'),
    refetchInterval: 5000,
  });
  const mcp = useQuery({
    queryKey: ['mcp-status'],
    queryFn: () => api<any>('/api/mcp/status'),
    refetchInterval: 5000,
  });
  const ai = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api<any>('/api/ai/status'),
  });

  if (health.isLoading || mcp.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Server Status" description="Health of HTTP API, MCP transport, database, and optional local AI." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>HTTP API</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Status" value={<Badge tone="success">{health.data?.status ?? 'unknown'}</Badge>} />
            <Row label="Version" value={health.data?.version} />
            <Row label="Uptime" value={formatDuration(health.data?.uptimeMs ?? 0)} />
            <Row
              label="Database"
              value={
                <Badge tone={health.data?.databaseHealthy ? 'success' : 'danger'}>
                  {health.data?.databaseHealthy ? 'healthy' : 'unhealthy'}
                </Badge>
              }
            />
          </dl>
        </Card>
        <Card>
          <CardTitle>MCP</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Client connected"
              value={
                <Badge tone={mcp.data?.connected ? 'success' : 'danger'}>
                  {mcp.data?.connected ? 'yes' : 'no'}
                </Badge>
              }
            />
            <Row label="Tools discovered" value={String(mcp.data?.toolCount ?? 0)} />
            <Row label="Active sessions" value={String(mcp.data?.sessions ?? 0)} />
            <Row label="Transport" value={mcp.data?.transport ?? '—'} />
            <Row label="HTTP endpoint" value={mcp.data?.endpoint ?? '/mcp'} />
            <Row label="Stdio entry" value="npm run mcp:stdio -w @local-mcp/server" />
          </dl>
        </Card>
        <Card className="md:col-span-2">
          <CardTitle>Optional local AI (Ollama)</CardTitle>
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label="Enabled"
              value={<Badge tone={ai.data?.enabled ? 'accent' : 'neutral'}>{String(!!ai.data?.enabled)}</Badge>}
            />
            <Row
              label="Connected"
              value={
                <Badge tone={ai.data?.connected ? 'success' : 'neutral'}>{String(!!ai.data?.connected)}</Badge>
              }
            />
            <Row label="Message" value={ai.data?.message ?? '—'} />
            {ai.data?.models && (
              <Row label="Models" value={(ai.data.models as string[]).join(', ') || 'none'} />
            )}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
