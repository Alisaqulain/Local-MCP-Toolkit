import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@/components/ui';
import type { Note } from '@local-mcp/shared';

export function NotesPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const listQuery = useQuery({
    queryKey: ['notes', query, tag],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (tag) params.set('tag', tag);
      return api<{ notes: Note[]; total: number }>(`/api/notes?${params}`);
    },
  });

  const notes = listQuery.data?.notes ?? [];
  const selected = notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content);
      setTags(selected.tags.join(', '));
      setDirty(false);
    }
  }, [selectedId]);

  const wordCount = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { words, chars: content.length };
  }, [content]);

  const create = useMutation({
    mutationFn: () =>
      api<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled note', content: '', tags: [] }),
      }),
    onSuccess: (note) => {
      toast.success('Note created');
      setSelectedId(note.id);
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags.join(', '));
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error('No note selected');
      return api<Note>(`/api/notes/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          content,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
    },
    onSuccess: () => {
      setDirty(false);
      toast.success('Saved');
      void qc.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      api(`/api/notes/${selectedId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true }),
      }),
    onSuccess: () => {
      toast.success('Deleted');
      setSelectedId(null);
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  function exportMd() {
    const blob = new Blob([`# ${title}\n\n${content}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\-]+/g, '_') || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        description="Persisted in the local SQLite database with FTS search."
        actions={
          <Button variant="primary" size="sm" onClick={() => create.mutate()}>
            New note
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Input
          placeholder="Filter tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="max-w-[160px]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : notes.length === 0 ? (
            <p className="p-3 text-sm text-fg-muted">No notes yet.</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(n.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedId === n.id ? 'bg-accent/15 text-accent' : 'hover:bg-bg-muted'
                    }`}
                  >
                    <p className="truncate font-medium">{n.title}</p>
                    <p className="truncate text-xs text-fg-muted">{n.tags.join(', ') || 'no tags'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {!selectedId ? (
          <EmptyState title="Select or create a note" />
        ) : (
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button size="sm" variant={mode === 'edit' ? 'primary' : 'ghost'} onClick={() => setMode('edit')}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'preview' ? 'primary' : 'ghost'}
                  onClick={() => setMode('preview')}
                >
                  Preview
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={dirty ? 'warning' : 'success'}>{dirty ? 'Unsaved' : 'Saved'}</Badge>
                <span className="text-xs text-fg-muted">
                  {wordCount.words} words · {wordCount.chars} chars
                </span>
                <Button size="sm" variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                  Save
                </Button>
                <Button size="sm" onClick={exportMd}>
                  Export MD
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              </div>
            </div>
            <Input
              className="mb-2 text-lg font-semibold"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
            <Input
              className="mb-3"
              placeholder="tags, comma, separated"
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                setDirty(true);
              }}
            />
            {mode === 'edit' ? (
              <Textarea
                className="min-h-[420px]"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
              />
            ) : (
              <div className="prose-preview min-h-[420px] rounded-lg border border-border bg-bg p-4">
                <ReactMarkdown>{content || '*Empty note*'}</ReactMarkdown>
              </div>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete note?"
        message="This permanently removes the note from SQLite."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
