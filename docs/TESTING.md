# Testing

## Unit tests

Located in `tests/unit/`:

- Path traversal / symlink containment
- SQL allowlist
- Calculate safety
- Notes CRUD
- Filesystem service
- Database query restrictions

```bash
npm run test:unit
```

## MCP integration

`tests/integration/mcp.test.ts` boots Fastify with Streamable HTTP, connects an SDK client, and verifies discovery + tool calls.

```bash
npm run test:integration
```

## Frontend

`OverviewPage.test.tsx` uses Vitest + Testing Library (jsdom). Run via workspace or root vitest as configured.

## E2E

Playwright smoke tests start (or reuse) the API and Vite servers.

```bash
npx playwright install chromium
npm run test:e2e
```

Tests use temporary directories / in-memory or temp SQLite — they do not modify your real workspace intentionally. Integration tests create temp dirs under the OS temp folder.
