import { z } from 'zod';
import { requestIdSchema, podIdSchema, positionSchema } from './base.js';

export const subAgentListSchema = z.object({
  requestId: requestIdSchema,
});

export const subAgentNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  subAgentId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const subAgentNoteListSchema = z.object({
  requestId: requestIdSchema,
});

export const subAgentNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const subAgentNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
});

export const podBindSubAgentSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  subAgentId: z.string(),
});

export const subAgentDeleteSchema = z.object({
  requestId: requestIdSchema,
  subAgentId: z.string(),
});

export type SubAgentListPayload = z.infer<typeof subAgentListSchema>;
export type SubAgentNoteCreatePayload = z.infer<typeof subAgentNoteCreateSchema>;
export type SubAgentNoteListPayload = z.infer<typeof subAgentNoteListSchema>;
export type SubAgentNoteUpdatePayload = z.infer<typeof subAgentNoteUpdateSchema>;
export type SubAgentNoteDeletePayload = z.infer<typeof subAgentNoteDeleteSchema>;
export type PodBindSubAgentPayload = z.infer<typeof podBindSubAgentSchema>;
export type SubAgentDeletePayload = z.infer<typeof subAgentDeleteSchema>;
