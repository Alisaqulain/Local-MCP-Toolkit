const TOKEN_KEY = 'local-mcp-session-token';

let tokenCache: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken(): string | null {
  return tokenCache;
}

export function setToken(token: string) {
  tokenCache = token;
  localStorage.setItem(TOKEN_KEY, token);
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function ensureToken(): Promise<string> {
  if (tokenCache) return tokenCache;
  const res = await fetch('/api/session');
  const json = await res.json();
  if (!json.token) throw new Error('Unable to obtain session token');
  setToken(json.token);
  return json.token;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await ensureToken();
  const headers = new Headers(options.headers);
  headers.set('X-Session-Token', token);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    if (!res.ok) {
      throw new ApiError(
        json?.error?.message || res.statusText,
        json?.error?.code || 'ERROR',
        res.status,
      );
    }
    return (json.data !== undefined ? json.data : json) as T;
  }
  if (!res.ok) {
    throw new ApiError(res.statusText, 'ERROR', res.status);
  }
  return (await res.text()) as T;
}
