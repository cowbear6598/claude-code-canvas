import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

export const outputStyleListSchema = z.object({
  requestId: requestIdSchema,
});

export const podBindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  outputStyleId: z.string(),
});

export const podUnbindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
});

export const outputStyleDeleteSchema = z.object({
  requestId: requestIdSchema,
  outputStyleId: z.string(),
});

export type OutputStyleListPayload = z.infer<typeof outputStyleListSchema>;
export type PodBindOutputStylePayload = z.infer<typeof podBindOutputStyleSchema>;
export type PodUnbindOutputStylePayload = z.infer<typeof podUnbindOutputStyleSchema>;
export type OutputStyleDeletePayload = z.infer<typeof outputStyleDeleteSchema>;
