import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

export const workflowGetDownstreamPodsSchema = z.object({
  requestId: requestIdSchema,
  sourcePodId: podIdSchema,
});

export const workflowClearSchema = z.object({
  requestId: requestIdSchema,
  sourcePodId: podIdSchema,
});

export type WorkflowGetDownstreamPodsPayload = z.infer<typeof workflowGetDownstreamPodsSchema>;
export type WorkflowClearPayload = z.infer<typeof workflowClearSchema>;
