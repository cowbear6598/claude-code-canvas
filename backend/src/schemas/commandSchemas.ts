import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceNameSchema, resourceIdSchema, groupIdSchema, noteUpdateBaseSchema, createNoteCreateSchema } from './base.js';

export const commandListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const commandCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: resourceNameSchema,
  content: z.string().max(10000000),
});

export const commandUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  commandId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const commandReadSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  commandId: resourceIdSchema,
});

export const commandNoteCreateSchema = createNoteCreateSchema({ commandId: resourceIdSchema });

export const commandNoteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const commandNoteUpdateSchema = noteUpdateBaseSchema;

export const commandNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export const podBindCommandSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  commandId: resourceIdSchema,
});

export const podUnbindCommandSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const commandDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  commandId: resourceIdSchema,
});

export const commandMoveToGroupSchema = z.object({
  requestId: requestIdSchema,
  itemId: resourceIdSchema,
  groupId: groupIdSchema,
});

export type CommandListPayload = z.infer<typeof commandListSchema>;
export type PodBindCommandPayload = z.infer<typeof podBindCommandSchema>;
export type PodUnbindCommandPayload = z.infer<typeof podUnbindCommandSchema>;
export type CommandDeletePayload = z.infer<typeof commandDeleteSchema>;
export type CommandCreatePayload = z.infer<typeof commandCreateSchema>;
export type CommandUpdatePayload = z.infer<typeof commandUpdateSchema>;
export type CommandReadPayload = z.infer<typeof commandReadSchema>;
export type CommandNoteCreatePayload = z.infer<typeof commandNoteCreateSchema>;
export type CommandNoteListPayload = z.infer<typeof commandNoteListSchema>;
export type CommandNoteUpdatePayload = z.infer<typeof commandNoteUpdateSchema>;
export type CommandNoteDeletePayload = z.infer<typeof commandNoteDeleteSchema>;
export type CommandMoveToGroupPayload = z.infer<typeof commandMoveToGroupSchema>;
