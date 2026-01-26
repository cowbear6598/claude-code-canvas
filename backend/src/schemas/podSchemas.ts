import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

// Pod enums
export const podColorSchema = z.enum(['blue', 'coral', 'pink', 'yellow', 'green']);

export const podTypeSchema = z.enum([
  'Code Assistant',
  'Chat Companion',
  'Creative Writer',
  'Data Analyst',
  'General AI',
]);

export const modelTypeSchema = z.enum(['opus', 'sonnet', 'haiku']);

// Pod CRUD schemas
export const podCreateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().min(1).max(100),
  type: podTypeSchema,
  color: podColorSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});

export const podListSchema = z.object({
  requestId: requestIdSchema,
});

export const podGetSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
});

export const podUpdateSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  name: z.string().min(1).max(100).optional(),
  model: modelTypeSchema.optional(),
});

export const podDeleteSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
});

// Inferred types
export type PodCreatePayload = z.infer<typeof podCreateSchema>;
export type PodListPayload = z.infer<typeof podListSchema>;
export type PodGetPayload = z.infer<typeof podGetSchema>;
export type PodUpdatePayload = z.infer<typeof podUpdateSchema>;
export type PodDeletePayload = z.infer<typeof podDeleteSchema>;
