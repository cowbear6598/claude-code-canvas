import { z } from 'zod';
import { requestIdSchema, podIdSchema, positionSchema } from './base.js';

export const commandListSchema = z.object({
  requestId: requestIdSchema,
});

export const commandCreateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().min(1).max(100),
  content: z.string(),
});

export const commandUpdateSchema = z.object({
  requestId: requestIdSchema,
  commandId: z.string(),
  content: z.string(),
});

export const commandReadSchema = z.object({
  requestId: requestIdSchema,
  commandId: z.string(),
});

export const commandNoteCreateSchema = z.object({
  requestId: requestIdSchema,
  commandId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const commandNoteListSchema = z.object({
  requestId: requestIdSchema,
});

export const commandNoteUpdateSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const commandNoteDeleteSchema = z.object({
  requestId: requestIdSchema,
  noteId: z.uuid(),
});

export const podBindCommandSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  commandId: z.string(),
});

export const podUnbindCommandSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
});

export const commandDeleteSchema = z.object({
  requestId: requestIdSchema,
  commandId: z.string(),
});

export type CommandListPayload = z.infer<typeof commandListSchema>;
export type CommandCreatePayload = z.infer<typeof commandCreateSchema>;
export type CommandUpdatePayload = z.infer<typeof commandUpdateSchema>;
export type CommandReadPayload = z.infer<typeof commandReadSchema>;
export type CommandNoteCreatePayload = z.infer<typeof commandNoteCreateSchema>;
export type CommandNoteListPayload = z.infer<typeof commandNoteListSchema>;
export type CommandNoteUpdatePayload = z.infer<typeof commandNoteUpdateSchema>;
export type CommandNoteDeletePayload = z.infer<typeof commandNoteDeleteSchema>;
export type PodBindCommandPayload = z.infer<typeof podBindCommandSchema>;
export type PodUnbindCommandPayload = z.infer<typeof podUnbindCommandSchema>;
export type CommandDeletePayload = z.infer<typeof commandDeleteSchema>;
