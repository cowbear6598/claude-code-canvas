import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema } from './base.js';

export const anchorPositionSchema = z.enum(['top', 'bottom', 'left', 'right']);

export const connectionCreateSchema = z
  .object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    sourceType: z.enum(['pod', 'trigger']).default('pod'),
    sourcePodId: podIdSchema.optional(),
    sourceTriggerId: z.uuid().nullable().optional(),
    sourceAnchor: anchorPositionSchema,
    targetPodId: podIdSchema,
    targetAnchor: anchorPositionSchema,
  })
  .refine(
    (data) => {
      if (data.sourceType === 'pod') {
        return data.sourcePodId !== undefined;
      }
      if (data.sourceType === 'trigger') {
        return data.sourceTriggerId !== undefined && data.sourceTriggerId !== null;
      }
      return false;
    },
    {
      message: 'sourcePodId is required when sourceType is "pod", sourceTriggerId is required when sourceType is "trigger"',
    }
  );

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
  autoTrigger: z.boolean().optional(),
});

export type ConnectionCreatePayload = z.infer<typeof connectionCreateSchema>;
export type ConnectionListPayload = z.infer<typeof connectionListSchema>;
export type ConnectionDeletePayload = z.infer<typeof connectionDeleteSchema>;
export type ConnectionUpdatePayload = z.infer<typeof connectionUpdateSchema>;
