import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as notes from '../../modules/notes/service.js';
import { registerZodTool } from './register.js';

export function registerNotesTools(server: McpServer): void {
  registerZodTool(server, {
    name: 'create_note',
    description: 'Create a note persisted in SQLite',
    category: 'notes',
    readOnly: false,
    permission: 'write',
    schema: z.object({
      title: z.string().min(1).max(500),
      content: z.string().max(500_000),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (a) => notes.createNote(a),
  });

  registerZodTool(server, {
    name: 'search_notes',
    description: 'Search saved notes by text and optional tag',
    category: 'notes',
    readOnly: true,
    permission: 'read',
    schema: z.object({
      query: z.string().min(1).max(500),
      tag: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (a) => notes.searchNotes(a),
  });

  registerZodTool(server, {
    name: 'get_note',
    description: 'Retrieve a single note by ID',
    category: 'notes',
    readOnly: true,
    permission: 'read',
    schema: z.object({ id: z.number().int().positive() }),
    handler: async (a) => {
      const note = notes.getNote(a.id);
      if (!note) throw new Error(`Note ${a.id} not found`);
      return note;
    },
  });

  registerZodTool(server, {
    name: 'update_note',
    description: 'Update an existing note',
    category: 'notes',
    readOnly: false,
    permission: 'write',
    schema: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(500).optional(),
      content: z.string().max(500_000).optional(),
      tags: z.array(z.string()).optional(),
    }),
    handler: async (a) => {
      const note = notes.updateNote(a);
      if (!note) throw new Error(`Note ${a.id} not found`);
      return note;
    },
  });

  registerZodTool(server, {
    name: 'delete_note',
    description: 'Delete a note; requires confirm: true',
    category: 'notes',
    readOnly: false,
    permission: 'write',
    schema: z.object({
      id: z.number().int().positive(),
      confirm: z.literal(true),
    }),
    handler: async (a) => notes.deleteNote(a.id, a.confirm),
  });
}
