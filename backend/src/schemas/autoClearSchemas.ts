import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';

export const podSetAutoClearSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  autoClear: z.boolean(),
});

export type PodSetAutoClearPayload = z.infer<typeof podSetAutoClearSchema>;
