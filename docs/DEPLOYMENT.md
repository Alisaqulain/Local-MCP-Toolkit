# Deployment

## Local / VPS (recommended for full fidelity)

```bash
npm run build
npm start
```

One Node process serves UI + `/api` + `/mcp` with durable SQLite and workspace disk.

## Vercel (Services — supported with limits)

This repo is configured for **one Vercel project with two services**:

| Service | Public? | Path | Role |
| --- | --- | --- | --- |
| `web` | yes | `/` (catch-all) | Vite static SPA |
| `server` | yes | `/api/*`, `/mcp` | Fastify API + MCP |

**No service bindings** — the browser calls same-origin `/api/*` via top-level rewrites. The server does not call the web service. Dashboard MCP uses **in-memory MCP transports** on Vercel (still real MCP protocol), because serverless cannot reliably self-HTTP to localhost.

### Import on Vercel

1. Import the GitHub repo.
2. Choose **Services / multi-service** (or let it detect `vercel.json`).
3. Confirm services named **`server`** and **`web`**.
4. Deploy.

### Environment variables (Vercel project)

Set on the project (both services inherit):

| Name | Suggested | Notes |
| --- | --- | --- |
| `SESSION_TOKEN` | long random string | Stable across cold starts |
| `ALLOW_NON_LOOPBACK` | `true` | Auto-enabled when `VERCEL=1` |
| `PUBLIC_ORIGIN` | `https://your-app.vercel.app` | Optional CORS helper |
| `LOG_LEVEL` | `info` | |

`WORKSPACE_PATH` / `DATABASE_PATH` default to `/tmp/local-mcp/...` on Vercel.

### Hard limits on Vercel

- **Ephemeral storage** — SQLite + workspace under `/tmp` reset on cold starts. Not your PC’s files.
- **No durable disk** — notes/history may vanish between isolates.
- **MCP HTTP sessions** — Streamable HTTP runs **stateless** on Vercel; dashboard uses in-memory MCP.
- **Filesystem tools** only see the `/tmp` sandbox, never your laptop.

For durable data, move off Vercel serverless to a persistent Node host (or add a cloud DB — not included unless you ask).
