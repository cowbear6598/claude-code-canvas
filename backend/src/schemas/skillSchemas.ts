import { z } from 'zod';
import { requestIdSchema, podIdSchema, positionSchema } from './base.js';

export const skillListSchema = z.object({
  requestId: requestIdSchema,
});

export const skillNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  skillId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const skillNoteListSchema = z.object({
  requestId: requestIdSchema,
});

export const skillNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const skillNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
});

export const podBindSkillSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  skillId: z.string(),
});

// Inferred types
export type SkillListPayload = z.infer<typeof skillListSchema>;
export type SkillNoteCreatePayload = z.infer<typeof skillNoteCreateSchema>;
export type SkillNoteListPayload = z.infer<typeof skillNoteListSchema>;
export type SkillNoteUpdatePayload = z.infer<typeof skillNoteUpdateSchema>;
export type SkillNoteDeletePayload = z.infer<typeof skillNoteDeleteSchema>;
export type PodBindSkillPayload = z.infer<typeof podBindSkillSchema>;
