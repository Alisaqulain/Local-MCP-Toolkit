import { PageHeader, Card, CardTitle } from '@/components/ui';

export function DocsPage() {
  return (
    <div>
      <PageHeader
        title="Documentation"
        description="How this toolkit uses the real Model Context Protocol — not a REST mock."
      />
      <div className="space-y-4">
        <Card>
          <CardTitle>What is MCP?</CardTitle>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            The Model Context Protocol (MCP) is an open protocol that lets clients discover and invoke
            tools, resources, and prompts exposed by servers. This project embeds an MCP server using
            the official TypeScript SDK and talks to it with a real MCP client.
          </p>
        </Card>
        <Card>
          <CardTitle>MCP vs HTTP endpoints</CardTitle>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-muted">
            <li>
              <strong className="text-fg">MCP tools</strong> are registered on the MCP server and invoked
              via <code className="font-mono text-xs">tools/list</code> and{' '}
              <code className="font-mono text-xs">tools/call</code>.
            </li>
            <li>
              <strong className="text-fg">Dashboard REST routes</strong> under <code>/api/*</code> handle
              health, settings, notes UI, file browsing convenience, and execution history.
            </li>
            <li>
              Tool discovery and execution in the Tools page always go through the MCP client → Streamable
              HTTP transport → MCP server.
            </li>
            <li>
              In production, Fastify serves the UI, <code>/api</code>, and <code>/mcp</code> on one origin
              (no separate frontend host).
            </li>
          </ul>
        </Card>
        <Card>
          <CardTitle>Transports</CardTitle>
          <p className="mt-3 text-sm text-fg-muted">
            Streamable HTTP is exposed at <code className="font-mono text-xs">POST/GET/DELETE /mcp</code>{' '}
            (loopback by default). A stdio transport is also available for desktop MCP clients via{' '}
            <code className="font-mono text-xs">npm run mcp:stdio -w @local-mcp/server</code>.
          </p>
        </Card>
        <Card>
          <CardTitle>More docs</CardTitle>
          <p className="mt-3 text-sm text-fg-muted">
            See the <code className="font-mono text-xs">docs/</code> folder in the repository for
            architecture, security, testing, and how to add tools.
          </p>
        </Card>
      </div>
    </div>
  );
}
