import { z } from 'zod';
import { requestIdSchema, positionSchema, canvasIdSchema } from './base.js';

export const noteCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const noteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const noteUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
  x: z.number().optional(),
  y: z.number().optional(),
  boundToPodId: z.uuid().nullable().optional(),
  originalPosition: positionSchema.nullable().optional(),
});

export const noteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export type NoteCreatePayload = z.infer<typeof noteCreateSchema>;
export type NoteListPayload = z.infer<typeof noteListSchema>;
export type NoteUpdatePayload = z.infer<typeof noteUpdateSchema>;
export type NoteDeletePayload = z.infer<typeof noteDeleteSchema>;
