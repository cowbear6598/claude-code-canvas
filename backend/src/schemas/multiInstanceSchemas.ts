import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';

export const podSetMultiInstanceSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  multiInstance: z.boolean(),
});

export type PodSetMultiInstancePayload = z.infer<typeof podSetMultiInstanceSchema>;
