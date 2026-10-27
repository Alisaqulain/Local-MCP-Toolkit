import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, CardTitle, Input, PageHeader, Spinner, Textarea } from '@/components/ui';
import type { AppSettings } from '@local-mcp/shared';

export function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/api/settings'),
  });
  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<AppSettings>) =>
      api<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (next) => {
      setForm(next);
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Server-validated preferences. Workspace path changes require updating .env and restarting."
        actions={
          <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate(form)}>
            Save
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Appearance</CardTitle>
          <label className="mt-3 block text-xs text-fg-muted">Theme</label>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            value={form.theme}
            onChange={(e) =>
              setForm({ ...form, theme: e.target.value as AppSettings['theme'] })
            }
          >
            <option value="dark">dark</option>
            <option value="light">light</option>
            <option value="system">system</option>
          </select>
        </Card>

        <Card>
          <CardTitle>Limits</CardTitle>
          <label className="mt-3 block text-xs text-fg-muted">Max file read bytes</label>
          <Input
            type="number"
            className="mt-1"
            value={form.maxFileReadBytes}
            onChange={(e) => setForm({ ...form, maxFileReadBytes: Number(e.target.value) })}
          />
          <label className="mt-3 block text-xs text-fg-muted">Max search results</label>
          <Input
            type="number"
            className="mt-1"
            value={form.maxSearchResults}
            onChange={(e) => setForm({ ...form, maxSearchResults: Number(e.target.value) })}
          />
          <label className="mt-3 block text-xs text-fg-muted">Log retention (days)</label>
          <Input
            type="number"
            className="mt-1"
            value={form.logRetentionDays}
            onChange={(e) => setForm({ ...form, logRetentionDays: Number(e.target.value) })}
          />
        </Card>

        <Card>
          <CardTitle>Allowed extensions (one per line)</CardTitle>
          <Textarea
            className="mt-3 min-h-[160px]"
            value={form.allowedExtensions.join('\n')}
            onChange={(e) =>
              setForm({
                ...form,
                allowedExtensions: e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Card>

        <Card>
          <CardTitle>Excluded directories (one per line)</CardTitle>
          <Textarea
            className="mt-3 min-h-[160px]"
            value={form.excludedDirectories.join('\n')}
            onChange={(e) =>
              setForm({
                ...form,
                excludedDirectories: e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Card>

        <Card>
          <CardTitle>Disabled tools (one name per line)</CardTitle>
          <Textarea
            className="mt-3 min-h-[120px]"
            value={(form.disabledTools ?? []).join('\n')}
            onChange={(e) =>
              setForm({
                ...form,
                disabledTools: e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Card>

        <Card>
          <CardTitle>Optional local AI (Ollama)</CardTitle>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.localAiEnabled}
              onChange={(e) => setForm({ ...form, localAiEnabled: e.target.checked })}
            />
            Enable local AI status checks
          </label>
          <label className="mt-3 block text-xs text-fg-muted">Base URL (localhost only)</label>
          <Input
            className="mt-1"
            value={form.localAiBaseUrl}
            onChange={(e) => setForm({ ...form, localAiBaseUrl: e.target.value })}
          />
          <label className="mt-3 block text-xs text-fg-muted">Model name</label>
          <Input
            className="mt-1"
            value={form.localAiModel}
            onChange={(e) => setForm({ ...form, localAiModel: e.target.value })}
          />
          <p className="mt-2 text-xs text-fg-muted">
            Core MCP tools work without any AI. Also set LOCAL_AI_ENABLED=true in .env.
          </p>
        </Card>

        <Card className="md:col-span-2">
          <CardTitle>Requires restart</CardTitle>
          <p className="mt-3 text-sm text-fg-muted">
            Workspace path (<code>WORKSPACE_PATH</code>), database path, host, and port are configured via
            environment variables in <code>.env</code> and require a server restart.
          </p>
        </Card>
      </div>
    </div>
  );
}
