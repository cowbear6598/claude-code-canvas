import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';

export const outputStyleListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const outputStyleCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: z.string().min(1).max(100),
  content: z.string(),
});

export const outputStyleUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: z.string(),
  content: z.string(),
});

export const outputStyleReadSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: z.string(),
});

export const podBindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  outputStyleId: z.string(),
});

export const podUnbindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const outputStyleDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: z.string(),
});

export type OutputStyleListPayload = z.infer<typeof outputStyleListSchema>;
export type PodBindOutputStylePayload = z.infer<typeof podBindOutputStyleSchema>;
export type PodUnbindOutputStylePayload = z.infer<typeof podUnbindOutputStyleSchema>;
export type OutputStyleDeletePayload = z.infer<typeof outputStyleDeleteSchema>;
