import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolCategory } from '@local-mcp/shared';
import { registerToolMeta } from '../tool-registry.js';
import { wrapTool } from './wrap.js';

export function registerZodTool<T extends z.ZodRawShape>(
  server: McpServer,
  options: {
    name: string;
    description: string;
    category: ToolCategory;
    readOnly: boolean;
    permission: 'read' | 'write' | 'admin';
    schema: z.ZodObject<T>;
    timeoutMs?: number;
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown> | unknown;
  },
): void {
  registerToolMeta({
    name: options.name,
    description: options.description,
    category: options.category,
    inputSchema: zodToJsonSchema(options.schema) as Record<string, unknown>,
    readOnly: options.readOnly,
    permission: options.permission,
    timeoutMs: options.timeoutMs ?? 30_000,
  });

  server.registerTool(
    options.name,
    {
      description: options.description,
      inputSchema: options.schema.shape,
      annotations: {
        readOnlyHint: options.readOnly,
        destructiveHint: !options.readOnly,
        openWorldHint: false,
      },
    },
    wrapTool(options.name, options.category, options.handler) as any,
  );
}
