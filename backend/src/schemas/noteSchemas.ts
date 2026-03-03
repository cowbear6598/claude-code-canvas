import { z } from 'zod';
import { noteUpdateBaseSchema, createNoteCreateSchema, canvasRequestSchema, noteDeleteBaseSchema } from './base.js';

export const noteCreateSchema = createNoteCreateSchema({ outputStyleId: z.string() });

export const noteListSchema = canvasRequestSchema;

export const noteUpdateSchema = noteUpdateBaseSchema;

export const noteDeleteSchema = noteDeleteBaseSchema;

export type NoteCreatePayload = z.infer<typeof noteCreateSchema>;
export type NoteListPayload = z.infer<typeof noteListSchema>;
export type NoteUpdatePayload = z.infer<typeof noteUpdateSchema>;
export type NoteDeletePayload = z.infer<typeof noteDeleteSchema>;
