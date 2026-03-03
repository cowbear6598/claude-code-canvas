import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceIdSchema, noteUpdateBaseSchema, createNoteCreateSchema, canvasRequestSchema, noteDeleteBaseSchema, podUnbindBaseSchema, moveToGroupSchema, createResourceReadSchema, createResourceCreateSchema } from './base.js';

export const commandListSchema = canvasRequestSchema;

export const commandCreateSchema = createResourceCreateSchema();

export const commandUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  commandId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const commandReadSchema = createResourceReadSchema('commandId');

export const commandNoteCreateSchema = createNoteCreateSchema({ commandId: resourceIdSchema });

export const commandNoteListSchema = canvasRequestSchema;

export const commandNoteUpdateSchema = noteUpdateBaseSchema;

export const commandNoteDeleteSchema = noteDeleteBaseSchema;

export const podBindCommandSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  commandId: resourceIdSchema,
});

export const podUnbindCommandSchema = podUnbindBaseSchema;

export const commandDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  commandId: resourceIdSchema,
});

export const commandMoveToGroupSchema = moveToGroupSchema;

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
