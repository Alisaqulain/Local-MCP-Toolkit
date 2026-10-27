import { describe, expect, it } from 'vitest';
import { validateReadOnlySelect } from '../../apps/server/src/security/sql.js';

describe('SQL safety', () => {
  it('allows simple SELECT', () => {
    expect(validateReadOnlySelect('SELECT * FROM notes').ok).toBe(true);
  });

  it('allows WITH ... SELECT', () => {
    expect(validateReadOnlySelect('WITH x AS (SELECT 1 AS n) SELECT * FROM x').ok).toBe(true);
  });

  it('rejects INSERT', () => {
    expect(validateReadOnlySelect('INSERT INTO notes VALUES (1)').ok).toBe(false);
  });

  it('rejects DROP', () => {
    expect(validateReadOnlySelect('DROP TABLE notes').ok).toBe(false);
  });

  it('rejects multiple statements', () => {
    expect(validateReadOnlySelect('SELECT 1; SELECT 2').ok).toBe(false);
  });

  it('rejects ATTACH', () => {
    expect(validateReadOnlySelect("ATTACH DATABASE 'x.db' AS x").ok).toBe(false);
  });

  it('rejects PRAGMA', () => {
    expect(validateReadOnlySelect('PRAGMA table_info(notes)').ok).toBe(false);
  });
});
