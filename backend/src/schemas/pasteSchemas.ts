import { z } from 'zod';
import { requestIdSchema, positionSchema } from './base.js';
import { podColorSchema, modelTypeSchema } from './podSchemas.js';
import { anchorPositionSchema } from './connectionSchemas.js';

export const pastePodItemSchema = z.object({
  originalId: z.uuid(),
  name: z.string().min(1).max(100),
  color: podColorSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  outputStyleId: z.string().nullable().optional(),
  skillIds: z.array(z.string()).optional(),
  subAgentIds: z.array(z.string()).optional(),
  model: modelTypeSchema.optional(),
  repositoryId: z.string().nullable().optional(),
  commandId: z.string().nullable().optional(),
});

export const pasteOutputStyleNoteItemSchema = z.object({
  outputStyleId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToOriginalPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const pasteSkillNoteItemSchema = z.object({
  skillId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToOriginalPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const pasteRepositoryNoteItemSchema = z.object({
  repositoryId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToOriginalPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const pasteSubAgentNoteItemSchema = z.object({
  subAgentId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToOriginalPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const pasteCommandNoteItemSchema = z.object({
  commandId: z.string(),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  boundToOriginalPodId: z.uuid().nullable(),
  originalPosition: positionSchema.nullable(),
});

export const pasteConnectionItemSchema = z.object({
  originalSourcePodId: z.uuid(),
  sourceAnchor: anchorPositionSchema,
  originalTargetPodId: z.uuid(),
  targetAnchor: anchorPositionSchema,
  autoTrigger: z.boolean().optional(),
});

export const canvasPasteSchema = z.object({
  requestId: requestIdSchema,
  pods: z.array(pastePodItemSchema),
  outputStyleNotes: z.array(pasteOutputStyleNoteItemSchema),
  skillNotes: z.array(pasteSkillNoteItemSchema),
  repositoryNotes: z.array(pasteRepositoryNoteItemSchema),
  subAgentNotes: z.array(pasteSubAgentNoteItemSchema),
  commandNotes: z.array(pasteCommandNoteItemSchema).optional(),
  connections: z.array(pasteConnectionItemSchema).optional(),
});

export type PastePodItem = z.infer<typeof pastePodItemSchema>;
export type PasteOutputStyleNoteItem = z.infer<typeof pasteOutputStyleNoteItemSchema>;
export type PasteSkillNoteItem = z.infer<typeof pasteSkillNoteItemSchema>;
export type PasteRepositoryNoteItem = z.infer<typeof pasteRepositoryNoteItemSchema>;
export type PasteSubAgentNoteItem = z.infer<typeof pasteSubAgentNoteItemSchema>;
export type PasteCommandNoteItem = z.infer<typeof pasteCommandNoteItemSchema>;
export type PasteConnectionItem = z.infer<typeof pasteConnectionItemSchema>;
export type CanvasPastePayload = z.infer<typeof canvasPasteSchema>;
