import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase, setDatabase } from '../../apps/server/src/db/database.js';
import * as notes from '../../apps/server/src/modules/notes/service.js';

describe('notes service', () => {
  beforeEach(() => {
    setDatabase(openMemoryDatabase());
  });

  it('creates and retrieves notes', () => {
    const n = notes.createNote({ title: 'Hello', content: 'World', tags: ['a'] });
    expect(n.id).toBeGreaterThan(0);
    expect(notes.getNote(n.id)?.title).toBe('Hello');
  });

  it('updates notes', () => {
    const n = notes.createNote({ title: 'A', content: 'B' });
    const u = notes.updateNote({ id: n.id, title: 'C' });
    expect(u?.title).toBe('C');
    expect(u?.content).toBe('B');
  });

  it('requires confirm to delete', () => {
    const n = notes.createNote({ title: 'X', content: 'Y' });
    expect(() => notes.deleteNote(n.id, false as unknown as true)).toThrow();
    expect(notes.deleteNote(n.id, true).deleted).toBe(true);
    expect(notes.getNote(n.id)).toBeNull();
  });

  it('searches notes', () => {
    notes.createNote({ title: 'Alpha project', content: 'details', tags: ['work'] });
    notes.createNote({ title: 'Beta', content: 'other' });
    const found = notes.searchNotes({ query: 'Alpha' });
    expect(found.some((n) => n.title.includes('Alpha'))).toBe(true);
  });
});
