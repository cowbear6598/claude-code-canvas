import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceIdSchema, noteUpdateBaseSchema, createNoteCreateSchema, canvasRequestSchema, noteDeleteBaseSchema, moveToGroupSchema, createResourceReadSchema, createResourceCreateSchema } from './base.js';

export const subAgentListSchema = canvasRequestSchema;

export const subAgentCreateSchema = createResourceCreateSchema();

export const subAgentUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  subAgentId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const subAgentReadSchema = createResourceReadSchema('subAgentId');

export const subAgentNoteCreateSchema = createNoteCreateSchema({ subAgentId: resourceIdSchema });

export const subAgentNoteListSchema = canvasRequestSchema;

export const subAgentNoteUpdateSchema = noteUpdateBaseSchema;

export const subAgentNoteDeleteSchema = noteDeleteBaseSchema;

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

export const subAgentMoveToGroupSchema = moveToGroupSchema;

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
