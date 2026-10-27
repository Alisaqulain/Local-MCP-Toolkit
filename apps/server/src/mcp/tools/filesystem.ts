import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fsService from '../../modules/filesystem/service.js';
import { registerZodTool } from './register.js';

export function registerFilesystemTools(server: McpServer): void {
  registerZodTool(server, {
    name: 'list_files',
    description: 'List files and directories inside the configured workspace',
    category: 'filesystem',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      path: z.string().default('.').describe('Workspace-relative path'),
      recursive: z.boolean().optional().describe('Recurse into subdirectories'),
      limit: z.number().int().min(1).max(2000).optional().describe('Max entries'),
    }),
    handler: async (args) =>
      fsService.listFiles({ path: args.path, recursive: args.recursive, limit: args.limit }),
  });

  registerZodTool(server, {
    name: 'search_files',
    description: 'Search files by name and optionally by text content within the workspace',
    category: 'filesystem',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      query: z.string().min(1).max(200),
      path: z.string().optional(),
      search_content: z.boolean().optional(),
      extensions: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    handler: async (args) =>
      fsService.searchFiles({
        query: args.query,
        path: args.path,
        searchContent: args.search_content,
        extensions: args.extensions,
        limit: args.limit,
      }),
  });

  registerZodTool(server, {
    name: 'read_file',
    description: 'Read a text file from the workspace (binary and oversized files are rejected)',
    category: 'filesystem',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      path: z.string().min(1),
      max_bytes: z.number().int().min(1).max(10_485_760).optional(),
    }),
    handler: async (args) => fsService.readFileSafe({ path: args.path, maxBytes: args.max_bytes }),
  });

  registerZodTool(server, {
    name: 'create_file',
    description: 'Create a new file in the workspace; refuses to overwrite existing files',
    category: 'filesystem',
    readOnly: false,
    permission: 'write',
    schema: z.object({
      path: z.string().min(1),
      content: z.string().max(5_000_000),
    }),
    handler: async (args) => fsService.createFileSafe({ path: args.path, content: args.content }),
  });

  registerZodTool(server, {
    name: 'create_directory',
    description: 'Create a directory inside the workspace',
    category: 'filesystem',
    readOnly: false,
    permission: 'write',
    schema: z.object({
      path: z.string().min(1),
    }),
    handler: async (args) => fsService.createDirectorySafe({ path: args.path }),
  });

  registerZodTool(server, {
    name: 'get_file_stats',
    description: 'Return workspace file/directory statistics',
    category: 'filesystem',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      path: z.string().optional(),
    }),
    handler: async (args) => fsService.getFileStats({ path: args.path }),
  });

  registerZodTool(server, {
    name: 'get_file_metadata',
    description: 'Return safe metadata for a workspace file or directory',
    category: 'filesystem',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      path: z.string().min(1),
    }),
    handler: async (args) => fsService.getFileMetadata({ path: args.path }),
  });
}
