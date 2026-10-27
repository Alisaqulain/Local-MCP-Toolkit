import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  Database,
  FileText,
  FolderOpen,
  Server,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDuration, formatRelative } from '@/lib/utils';
import { Badge, Card, CardTitle, EmptyState, PageHeader, Spinner, Button } from '@/components/ui';
import type { OverviewStats } from '@local-mcp/shared';

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api<OverviewStats>('/api/overview'),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Unable to load overview"
        description={error instanceof Error ? error.message : 'Backend unreachable'}
      />
    );
  }

  const h = data.health;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live metrics from the local MCP server, workspace, and SQLite store."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MCP status"
          value={h.mcpConnected ? 'Connected' : 'Disconnected'}
          tone={h.mcpConnected ? 'success' : 'danger'}
          icon={<Server className="h-4 w-4" />}
        />
        <StatCard label="Registered tools" value={String(h.toolCount)} icon={<Wrench className="h-4 w-4" />} />
        <StatCard
          label="Successful runs"
          value={String(data.successfulExecutions)}
          tone="success"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Failed runs"
          value={String(data.failedExecutions)}
          tone={data.failedExecutions ? 'danger' : 'neutral'}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Uptime" value={formatDuration(h.uptimeMs)} />
        <StatCard
          label="Workspace files"
          value={String(data.workspaceStats.fileCount)}
          icon={<FolderOpen className="h-4 w-4" />}
        />
        <StatCard label="Workspace size" value={formatBytes(data.workspaceStats.totalBytes)} />
        <StatCard
          label="Database"
          value={h.databaseHealthy ? 'Healthy' : 'Error'}
          tone={h.databaseHealthy ? 'success' : 'danger'}
          icon={<Database className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link to="/files">
          <Button variant="primary" size="sm">
            <FolderOpen className="h-4 w-4" /> Browse files
          </Button>
        </Link>
        <Link to="/tools">
          <Button size="sm">
            <Wrench className="h-4 w-4" /> Test an MCP tool
          </Button>
        </Link>
        <Link to="/notes">
          <Button size="sm">
            <FileText className="h-4 w-4" /> Create a note
          </Button>
        </Link>
        <Link to="/logs">
          <Button size="sm">
            <Activity className="h-4 w-4" /> View execution logs
          </Button>
        </Link>
        <Link to="/status">
          <Button size="sm">
            <Server className="h-4 w-4" /> Server status
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent executions</CardTitle>
          {data.recentExecutions.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">No tools executed yet. Open MCP Tools to run one.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentExecutions.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-bg-muted/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.toolName}</p>
                    <p className="truncate text-xs text-fg-muted">{formatRelative(e.startedAt)}</p>
                  </div>
                  <Badge tone={e.status === 'success' ? 'success' : 'danger'}>{e.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Recent notes</CardTitle>
          {data.recentNotes.length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">No notes yet. Create one from the Notes page.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentNotes.map((n) => (
                <li key={n.id} className="rounded-lg bg-bg-muted/60 px-3 py-2 text-sm">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-fg-muted">{formatRelative(n.updatedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>Tool usage by category</CardTitle>
          {Object.keys(data.toolUsageByCategory).length === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">Usage stats appear after the first tool executions.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(data.toolUsageByCategory).map(([cat, count]) => (
                <div key={cat} className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-fg-muted">{cat}</p>
                  <p className="text-xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger';
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>{label}</CardTitle>
        <span className="text-fg-muted">{icon}</span>
      </div>
      <p
        className={
          tone === 'success'
            ? 'mt-2 text-2xl font-semibold text-success'
            : tone === 'danger'
              ? 'mt-2 text-2xl font-semibold text-danger'
              : 'mt-2 text-2xl font-semibold'
        }
      >
        {value}
      </p>
    </Card>
  );
}
