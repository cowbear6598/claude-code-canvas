import { z } from 'zod';
import { requestIdSchema, canvasIdSchema, noteUpdateBaseSchema, createNoteCreateSchema } from './base.js';

export const noteCreateSchema = createNoteCreateSchema({ outputStyleId: z.string() });

export const noteListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const noteUpdateSchema = noteUpdateBaseSchema;

export const noteDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  noteId: z.uuid(),
});

export type NoteCreatePayload = z.infer<typeof noteCreateSchema>;
export type NoteListPayload = z.infer<typeof noteListSchema>;
export type NoteUpdatePayload = z.infer<typeof noteUpdateSchema>;
export type NoteDeletePayload = z.infer<typeof noteDeleteSchema>;
