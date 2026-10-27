import { z } from 'zod';

export const noteCreateSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(500_000),
  tags: z.array(z.string().min(1).max(64)).max(20).optional().default([]),
});

export const noteUpdateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
});

export const noteDeleteSchema = z.object({
  id: z.number().int().positive(),
  confirm: z.literal(true),
});

export const settingsUpdateSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  maxFileReadBytes: z.number().int().min(1024).max(10_485_760).optional(),
  maxSearchResults: z.number().int().min(1).max(1000).optional(),
  allowedExtensions: z.array(z.string().min(1).max(32)).max(100).optional(),
  excludedDirectories: z.array(z.string().min(1).max(128)).max(50).optional(),
  logRetentionDays: z.number().int().min(1).max(365).optional(),
  localAiEnabled: z.boolean().optional(),
  localAiBaseUrl: z.string().url().optional(),
  localAiModel: z.string().max(128).optional(),
  disabledTools: z.array(z.string().min(1).max(128)).max(100).optional(),
});

export const safeSelectSchema = z.object({
  sql: z.string().min(1).max(10_000),
  limit: z.number().int().min(1).max(500).optional(),
});

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
