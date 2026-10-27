const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|ANALYZE|GRANT|REVOKE|TRUNCATE|INTO|EXEC|EXECUTE|LOAD_EXTENSION)\b/i;

/**
 * Validate that SQL is a single read-only SELECT statement.
 */
export function validateReadOnlySelect(sql: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Empty SQL' };
  }

  // Reject multiple statements
  const withoutStrings = stripSqlStrings(trimmed);
  if (withoutStrings.includes(';')) {
    const parts = withoutStrings.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return { ok: false, reason: 'Multiple statements are not allowed' };
    }
  }

  const body = trimmed.replace(/;+\s*$/, '');
  if (!/^\s*(WITH\b[\s\S]+)?SELECT\b/i.test(body)) {
    return { ok: false, reason: 'Only SELECT statements are allowed' };
  }

  if (FORBIDDEN.test(body)) {
    return { ok: false, reason: 'Statement contains forbidden keywords' };
  }

  // Block comments that might hide keywords in some edge cases — strip then recheck
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
  if (FORBIDDEN.test(noComments) && !/^\s*(WITH\b[\s\S]+)?SELECT\b/i.test(noComments)) {
    return { ok: false, reason: 'Invalid SELECT statement' };
  }
  if (FORBIDDEN.test(noComments)) {
    return { ok: false, reason: 'Statement contains forbidden keywords' };
  }

  return { ok: true };
}

function stripSqlStrings(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:""|[^"])*"/g, '""');
}
