# Security

## Threat model (local)

Even on localhost, a malicious website can attempt DNS rebinding or CSRF-like calls to a local agent. This toolkit:

1. Binds to loopback by default
2. Rejects non-loopback `Host` headers
3. Enforces CORS + Origin allowlist for browser requests
4. Requires `X-Session-Token` for `/api/*` (except `/api/health` and `/api/session`)
5. Enables MCP transport DNS rebinding protection

## Filesystem

- All paths resolved against workspace root
- Absolute paths rejected
- `..` traversal rejected
- Symlink realpath containment checked when links exist
- Create uses exclusive open (`wx`) — no silent overwrite
- Binary / oversized reads rejected

## SQL

- Application database only
- `validateReadOnlySelect` rejects writes, multi-statements, `ATTACH`, `PRAGMA`, etc.
- Prefer readonly SQLite connection
- Row limits enforced

## General

- No shell execution from the browser or tools
- No `eval` / `Function` for calculate
- Request body size limits + rate limiting
- Helmet security headers
- Errors sanitized for clients; stack traces stay in logs
- Inputs validated with Zod

## Dependency auditing

```bash
npm run audit
```

Review and upgrade regularly. Do not commit `.env` with custom secrets if you set `SESSION_TOKEN`.
