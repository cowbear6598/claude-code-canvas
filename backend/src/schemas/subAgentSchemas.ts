import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceNameSchema, resourceIdSchema, groupIdSchema, noteUpdateBaseSchema, createNoteCreateSchema } from './base.js';

export const subAgentListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const subAgentCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: resourceNameSchema,
  content: z.string().max(10000000),
});

export const subAgentUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const subAgentReadSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: resourceIdSchema,
});

export const subAgentNoteCreateSchema = createNoteCreateSchema({ subAgentId: resourceIdSchema });

export const subAgentNoteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const subAgentNoteUpdateSchema = noteUpdateBaseSchema;

export const subAgentNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export const podBindSubAgentSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  subAgentId: resourceIdSchema,
});

export const subAgentDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: resourceIdSchema,
});

export const subAgentMoveToGroupSchema = z.object({
  requestId: requestIdSchema,
  itemId: resourceIdSchema,
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
