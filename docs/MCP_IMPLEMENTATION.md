# MCP Implementation

## SDK

- Package: `@modelcontextprotocol/sdk` (v1.x)
- Server: `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- HTTP transport: `StreamableHTTPServerTransport`
- Client transport: `StreamableHTTPClientTransport`
- Stdio: `StdioServerTransport`

## Server

`apps/server/src/mcp/server.ts` creates an `McpServer` and registers tools via `server.tool(name, description, zodShape, handler)`.

Each tool handler is wrapped (`wrap.ts`) to:

- Check enable/disable settings
- Record execution history (redacted)
- Return MCP content blocks (`{ content: [{ type: 'text', text }] }`)
- Set `isError: true` on failures

## HTTP transport

`POST/GET/DELETE /mcp` with session management (`mcp-session-id`).

- `enableJsonResponse: true` for simpler local clients
- `enableDnsRebindingProtection: true`
- `allowedHosts: 127.0.0.1, localhost, [::1]`

## Dashboard path

1. UI calls `GET /api/tools`
2. Backend `McpClientService` connects to `http://127.0.0.1:PORT/mcp`
3. Client runs `listTools()` / `callTool()` — real protocol

## Stdio

`npm run mcp:stdio -w @local-mcp/server` for desktop hosts.

## Registered tools

**Filesystem:** `list_files`, `search_files`, `read_file`, `create_file`, `create_directory`, `get_file_stats`, `get_file_metadata`

**Notes:** `create_note`, `search_notes`, `get_note`, `update_note`, `delete_note`

**Database:** `get_database_info`, `list_database_tables`, `query_database`

**Utility / search:** `get_current_time`, `calculate`, `get_workspace_info`, `search_workspace`
