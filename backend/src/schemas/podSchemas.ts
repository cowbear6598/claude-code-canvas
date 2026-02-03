import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';
import { scheduleConfigSchema } from './scheduleSchemas.js';

export const podColorSchema = z.enum(['blue', 'coral', 'pink', 'yellow', 'green']);

export const modelTypeSchema = z.enum(['opus', 'sonnet', 'haiku']);

export const podCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: z.string().min(1).max(100),
  color: podColorSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});

export const podListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const podGetSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const podUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  name: z.string().min(1).max(100).optional(),
  model: modelTypeSchema.optional(),
  schedule: scheduleConfigSchema.optional().nullable(),
});

export const podDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const podJoinSchema = z.object({
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const podJoinBatchSchema = z.object({
  canvasId: canvasIdSchema,
  podIds: z.array(podIdSchema),
});

export const podLeaveSchema = z.object({
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export type PodCreatePayload = z.infer<typeof podCreateSchema>;
export type PodListPayload = z.infer<typeof podListSchema>;
export type PodGetPayload = z.infer<typeof podGetSchema>;
export type PodUpdatePayload = z.infer<typeof podUpdateSchema>;
export type PodDeletePayload = z.infer<typeof podDeleteSchema>;
export type PodJoinPayload = z.infer<typeof podJoinSchema>;
export type PodJoinBatchPayload = z.infer<typeof podJoinBatchSchema>;
export type PodLeavePayload = z.infer<typeof podLeaveSchema>;
