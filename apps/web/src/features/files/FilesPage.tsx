import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  File,
  FileJson,
  FileText,
  Folder,
  Grid3X3,
  List,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@/components/ui';
import type { FileEntry } from '@local-mcp/shared';

export function FilesPage() {
  const qc = useQueryClient();
  const [path, setPath] = useState('.');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);
  const [mdMode, setMdMode] = useState<'preview' | 'raw'>('preview');

  const listQuery = useQuery({
    queryKey: ['files', path],
    queryFn: () =>
      api<{ entries: FileEntry[]; truncated: boolean }>(
        `/api/files?path=${encodeURIComponent(path)}`,
      ),
  });

  const crumbs = useMemo(() => {
    if (!path || path === '.') return [{ label: 'workspace', value: '.' }];
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    const items = [{ label: 'workspace', value: '.' }];
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      items.push({ label: p, value: acc });
    }
    return items;
  }, [path]);

  const entries = (listQuery.data?.entries ?? []).filter((e) =>
    query ? e.name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  const mkdir = useMutation({
    mutationFn: async () => {
      const name = window.prompt('Directory name');
      if (!name) return null;
      const target = path === '.' ? name : `${path}/${name}`;
      return api('/api/files/mkdir', { method: 'POST', body: JSON.stringify({ path: target }) });
    },
    onSuccess: (r) => {
      if (!r) return;
      toast.success('Directory created');
      void qc.invalidateQueries({ queryKey: ['files', path] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createFile = useMutation({
    mutationFn: async () => {
      const name = window.prompt('File name');
      if (!name) return null;
      const target = path === '.' ? name : `${path}/${name}`;
      return api('/api/files/create', {
        method: 'POST',
        body: JSON.stringify({ path: target, content: '' }),
      });
    },
    onSuccess: (r) => {
      if (!r) return;
      toast.success('File created');
      void qc.invalidateQueries({ queryKey: ['files', path] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openEntry(entry: FileEntry) {
    if (entry.type === 'directory') {
      setPath(entry.path);
      setPreview(null);
      return;
    }
    try {
      const data = await api<{ content: string; path: string }>(
        `/api/files/read?path=${encodeURIComponent(entry.path)}`,
      );
      setPreview({ path: data.path, content: data.content });
      setMdMode('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Read failed');
    }
  }

  function copyPath(p: string) {
    void navigator.clipboard.writeText(p);
    toast.success('Path copied');
  }

  const isJson = preview?.path.toLowerCase().endsWith('.json');
  const isMd = preview?.path.toLowerCase().endsWith('.md') || preview?.path.toLowerCase().endsWith('.markdown');
  let pretty = preview?.content ?? '';
  if (isJson && preview) {
    try {
      pretty = JSON.stringify(JSON.parse(preview.content), null, 2);
    } catch {
      pretty = preview.content;
    }
  }

  return (
    <div>
      <PageHeader
        title="File Explorer"
        description="Sandboxed to the configured workspace. Absolute paths and traversal are rejected."
        actions={
          <>
            <Button size="sm" onClick={() => mkdir.mutate()}>
              New folder
            </Button>
            <Button size="sm" onClick={() => createFile.mutate()}>
              New file
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void qc.invalidateQueries({ queryKey: ['files', path] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.value} className="flex items-center gap-2">
            {i > 0 && <span className="text-fg-muted">/</span>}
            <button type="button" className="text-accent hover:underline" onClick={() => setPath(c.value)}>
              {c.label}
            </button>
          </span>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-muted" />
          <Input
            className="pl-9"
            placeholder="Filter current directory…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" variant={view === 'list' ? 'primary' : 'ghost'} onClick={() => setView('list')}>
          <List className="h-4 w-4" />
        </Button>
        <Button size="sm" variant={view === 'grid' ? 'primary' : 'ghost'} onClick={() => setView('grid')}>
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-h-[320px]">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState title="Empty directory" description="Create a file or folder to get started." />
          ) : view === 'list' ? (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.path}>
                  <button
                    type="button"
                    onClick={() => void openEntry(e)}
                    className="flex w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-bg-muted/60"
                  >
                    <FileIcon entry={e} />
                    <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                    <span className="text-xs text-fg-muted">
                      {e.type === 'file' && e.size != null ? formatBytes(e.size) : 'dir'}
                    </span>
                    <span className="hidden text-xs text-fg-muted sm:inline">
                      {e.modifiedAt ? formatRelative(e.modifiedAt) : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {entries.map((e) => (
                <button
                  key={e.path}
                  type="button"
                  onClick={() => void openEntry(e)}
                  className="rounded-lg border border-border p-3 text-left text-sm hover:bg-bg-muted"
                >
                  <FileIcon entry={e} />
                  <p className="mt-2 truncate font-medium">{e.name}</p>
                  <p className="text-xs text-fg-muted">{e.type}</p>
                </button>
              ))}
            </div>
          )}
          {listQuery.data?.truncated && (
            <p className="mt-2 text-xs text-warning">Listing truncated by server limit.</p>
          )}
        </Card>

        <Card className="min-h-[320px]">
          {!preview ? (
            <EmptyState title="No file selected" description="Open a text file to preview its contents." />
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-medium">{preview.path}</p>
                  <div className="mt-1 flex gap-2">
                    {isJson && <Badge tone="accent">JSON</Badge>}
                    {isMd && <Badge tone="accent">Markdown</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => copyPath(preview.path)}>
                    Copy path
                  </Button>
                  {isMd && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMdMode((m) => (m === 'preview' ? 'raw' : 'preview'))}
                    >
                      {mdMode === 'preview' ? 'Raw' : 'Preview'}
                    </Button>
                  )}
                </div>
              </div>
              {isMd && mdMode === 'preview' ? (
                <div className="prose-preview max-h-[55vh] overflow-auto rounded-lg bg-bg-muted p-4 text-sm">
                  <ReactMarkdown>{preview.content}</ReactMarkdown>
                </div>
              ) : (
                <Textarea className="min-h-[55vh]" readOnly value={pretty} />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.type === 'directory') return <Folder className="h-4 w-4 text-accent" />;
  const ext = entry.extension || '';
  if (ext === '.json') return <FileJson className="h-4 w-4 text-warning" />;
  if (ext === '.md' || ext === '.markdown' || ext === '.txt')
    return <FileText className="h-4 w-4 text-success" />;
  return <File className="h-4 w-4 text-fg-muted" />;
}
