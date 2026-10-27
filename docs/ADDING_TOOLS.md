# Adding an MCP Tool

1. Implement domain logic under `apps/server/src/modules/...`
2. Create or extend a file in `apps/server/src/mcp/tools/`
3. Define a Zod input schema
4. Call `registerToolMeta(...)` for dashboard metadata
5. Register with the SDK:

```ts
server.tool(name, description, schema.shape, wrapTool(name, category, handler));
```

6. Export registration from `tools/index.ts` via `registerAllTools`
7. Add unit tests for the module + an integration assertion if protocol-sensitive
8. Rebuild / restart the server

## Guidelines

- Prefer read-only tools when possible
- Never accept absolute filesystem paths
- Redaction happens in `wrapTool` via `redactInput`
- Destructive tools should require an explicit `confirm: true` field
- Keep descriptions accurate — they are shown to MCP clients
