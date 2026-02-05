import { z } from 'zod';
import { requestIdSchema, podIdSchema, positionSchema, canvasIdSchema } from './base.js';

export const subAgentListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const subAgentCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: z.string().min(1).max(100),
  content: z.string(),
});

export const subAgentUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: z.string(),
  content: z.string(),
});

export const subAgentReadSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: z.string(),
});

export const subAgentNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const subAgentNoteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const subAgentNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const subAgentNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export const podBindSubAgentSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  subAgentId: z.string(),
});

export const subAgentDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: z.string(),
});

const groupIdSchema = z.string().regex(/^[a-zA-Z0-9-]+$/, '群組 ID 格式不正確，只能包含英文、數字、dash').nullable();

export const subAgentMoveToGroupSchema = z.object({
  requestId: requestIdSchema,
  itemId: z.string(),
  groupId: groupIdSchema,
});

export type SubAgentListPayload = z.infer<typeof subAgentListSchema>;
export type PodBindSubAgentPayload = z.infer<typeof podBindSubAgentSchema>;
export type SubAgentDeletePayload = z.infer<typeof subAgentDeleteSchema>;
export type SubAgentCreatePayload = z.infer<typeof subAgentCreateSchema>;
export type SubAgentUpdatePayload = z.infer<typeof subAgentUpdateSchema>;
export type SubAgentReadPayload = z.infer<typeof subAgentReadSchema>;
export type SubAgentNoteCreatePayload = z.infer<typeof subAgentNoteCreateSchema>;
export type SubAgentNoteListPayload = z.infer<typeof subAgentNoteListSchema>;
export type SubAgentNoteUpdatePayload = z.infer<typeof subAgentNoteUpdateSchema>;
export type SubAgentNoteDeletePayload = z.infer<typeof subAgentNoteDeleteSchema>;
export type SubAgentMoveToGroupPayload = z.infer<typeof subAgentMoveToGroupSchema>;
