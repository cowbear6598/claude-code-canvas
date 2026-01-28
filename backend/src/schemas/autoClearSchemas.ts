import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

export const podSetAutoClearSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  autoClear: z.boolean(),
});

export type PodSetAutoClearPayload = z.infer<typeof podSetAutoClearSchema>;
