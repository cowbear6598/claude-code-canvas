import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceIdSchema, canvasRequestSchema, podUnbindBaseSchema, moveToGroupSchema, createResourceReadSchema, createResourceCreateSchema } from './base.js';

export const outputStyleListSchema = canvasRequestSchema;

export const outputStyleCreateSchema = createResourceCreateSchema();

export const outputStyleUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const outputStyleReadSchema = createResourceReadSchema('outputStyleId');

export const podBindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  outputStyleId: resourceIdSchema,
});

export const podUnbindOutputStyleSchema = podUnbindBaseSchema;

export const outputStyleDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: resourceIdSchema,
});

export const outputStyleMoveToGroupSchema = moveToGroupSchema;

export type OutputStyleListPayload = z.infer<typeof outputStyleListSchema>;
export type PodBindOutputStylePayload = z.infer<typeof podBindOutputStyleSchema>;
export type PodUnbindOutputStylePayload = z.infer<typeof podUnbindOutputStyleSchema>;
export type OutputStyleDeletePayload = z.infer<typeof outputStyleDeleteSchema>;
export type OutputStyleCreatePayload = z.infer<typeof outputStyleCreateSchema>;
export type OutputStyleUpdatePayload = z.infer<typeof outputStyleUpdateSchema>;
export type OutputStyleReadPayload = z.infer<typeof outputStyleReadSchema>;
export type OutputStyleMoveToGroupPayload = z.infer<typeof outputStyleMoveToGroupSchema>;
