import { z } from 'zod';
import { podIdSchema, canvasIdSchema, requestIdSchema, noteUpdateBaseSchema, createNoteCreateSchema, canvasRequestSchema, noteDeleteBaseSchema } from './base.js';

export const skillListSchema = canvasRequestSchema;

export const skillNoteCreateSchema = createNoteCreateSchema({ skillId: z.string() });

export const skillNoteListSchema = canvasRequestSchema;

export const skillNoteUpdateSchema = noteUpdateBaseSchema;

export const skillNoteDeleteSchema = noteDeleteBaseSchema;

export const podBindSkillSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  skillId: z.string(),
});

export const skillDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  skillId: z.string(),
});

export const skillImportSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  fileName: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+\.zip$/i, '檔名格式不正確'),
  fileData: z.string().min(1).max(7 * 1024 * 1024, 'Base64 資料超過大小限制'),
  fileSize: z.number().int().positive(),
});

export type SkillListPayload = z.infer<typeof skillListSchema>;
export type PodBindSkillPayload = z.infer<typeof podBindSkillSchema>;
export type SkillDeletePayload = z.infer<typeof skillDeleteSchema>;
export type SkillImportPayload = z.infer<typeof skillImportSchema>;
export type SkillNoteCreatePayload = z.infer<typeof skillNoteCreateSchema>;
export type SkillNoteListPayload = z.infer<typeof skillNoteListSchema>;
export type SkillNoteUpdatePayload = z.infer<typeof skillNoteUpdateSchema>;
export type SkillNoteDeletePayload = z.infer<typeof skillNoteDeleteSchema>;
