import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';

export const anchorPositionSchema = z.enum(['top', 'bottom', 'left', 'right']);

export const connectionCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  sourcePodId: podIdSchema,
  sourceAnchor: anchorPositionSchema,
  targetPodId: podIdSchema,
  targetAnchor: anchorPositionSchema,
});

export const connectionListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const connectionDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  connectionId: z.uuid(),
});

export const connectionUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  connectionId: z.uuid(),
  triggerMode: z.enum(['auto', 'ai-decide']).optional(),
});

export type ConnectionCreatePayload = z.infer<typeof connectionCreateSchema>;
export type ConnectionListPayload = z.infer<typeof connectionListSchema>;
export type ConnectionDeletePayload = z.infer<typeof connectionDeleteSchema>;
export type ConnectionUpdatePayload = z.infer<typeof connectionUpdateSchema>;
