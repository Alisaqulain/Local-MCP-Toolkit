import type { Note } from '@local-mcp/shared';
import { getDatabase } from '../../db/database.js';

type NoteRow = {
  id: number;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
};

function mapNote(row: NoteRow): Note {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createNote(input: {
  title: string;
  content: string;
  tags?: string[];
}): Note {
  const db = getDatabase();
  const now = new Date().toISOString();
  const tags = JSON.stringify(input.tags ?? []);
  const result = db
    .prepare(
      `INSERT INTO notes (title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.title, input.content, tags, now, now);
  return getNote(Number(result.lastInsertRowid))!;
}

export function getNote(id: number): Note | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined;
  return row ? mapNote(row) : null;
}

export function updateNote(input: {
  id: number;
  title?: string;
  content?: string;
  tags?: string[];
}): Note | null {
  const existing = getNote(input.id);
  if (!existing) return null;
  const db = getDatabase();
  const now = new Date().toISOString();
  const title = input.title ?? existing.title;
  const content = input.content ?? existing.content;
  const tags = JSON.stringify(input.tags ?? existing.tags);
  db.prepare(`UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?`).run(
    title,
    content,
    tags,
    now,
    input.id,
  );
  return getNote(input.id);
}

export function deleteNote(id: number, confirm: boolean): { deleted: boolean; id: number } {
  if (!confirm) {
    throw new Error('Deletion requires confirm: true');
  }
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
  return { deleted: result.changes > 0, id };
}

export function searchNotes(opts: {
  query?: string;
  tag?: string;
  limit?: number;
}): Note[] {
  const db = getDatabase();
  const limit = Math.min(opts.limit ?? 50, 200);
  const query = opts.query?.trim();

  if (query) {
    try {
      const rows = db
        .prepare(
          `SELECT n.* FROM notes n
           JOIN notes_fts f ON n.id = f.rowid
           WHERE notes_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(escapeFts(query), limit) as NoteRow[];
      let notes = rows.map(mapNote);
      if (opts.tag) {
        notes = notes.filter((n) => n.tags.includes(opts.tag!));
      }
      return notes;
    } catch {
      // Fallback to LIKE search
    }
  }

  let sql = `SELECT * FROM notes WHERE 1=1`;
  const params: unknown[] = [];
  if (query) {
    sql += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`;
    const like = `%${query}%`;
    params.push(like, like, like);
  }
  if (opts.tag) {
    sql += ` AND tags LIKE ?`;
    params.push(`%"${opts.tag}"%`);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...(params as (string | number)[])) as NoteRow[];
  return rows.map(mapNote);
}

export function listNotes(opts: {
  limit?: number;
  offset?: number;
  sort?: 'created' | 'updated';
  order?: 'asc' | 'desc';
} = {}): { notes: Note[]; total: number } {
  const db = getDatabase();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const sortCol = opts.sort === 'created' ? 'created_at' : 'updated_at';
  const order = opts.order === 'asc' ? 'ASC' : 'DESC';
  const total = (db.prepare(`SELECT COUNT(*) as c FROM notes`).get() as { c: number }).c;
  const rows = db
    .prepare(`SELECT * FROM notes ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`)
    .all(limit, offset) as NoteRow[];
  return { notes: rows.map(mapNote), total };
}

function escapeFts(query: string): string {
  const cleaned = query.replace(/["']/g, ' ').trim();
  if (!cleaned) return '""';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`)
    .join(' OR ');
}
