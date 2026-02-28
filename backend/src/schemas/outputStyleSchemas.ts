import { z } from 'zod';
import { requestIdSchema, podIdSchema, canvasIdSchema, resourceNameSchema, resourceIdSchema, groupIdSchema } from './base.js';

export const outputStyleListSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
});

export const outputStyleCreateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  name: resourceNameSchema,
  content: z.string().max(10000000),
});

export const outputStyleUpdateSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: resourceIdSchema,
  content: z.string().max(10000000),
});

export const outputStyleReadSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: resourceIdSchema,
});

export const podBindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
  outputStyleId: resourceIdSchema,
});

export const podUnbindOutputStyleSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  podId: podIdSchema,
});

export const outputStyleDeleteSchema = z.object({
  requestId: requestIdSchema,
  canvasId: canvasIdSchema,
  outputStyleId: resourceIdSchema,
});

export const outputStyleMoveToGroupSchema = z.object({
  requestId: requestIdSchema,
  itemId: resourceIdSchema,
  groupId: groupIdSchema,
});

export type OutputStyleListPayload = z.infer<typeof outputStyleListSchema>;
export type PodBindOutputStylePayload = z.infer<typeof podBindOutputStyleSchema>;
export type PodUnbindOutputStylePayload = z.infer<typeof podUnbindOutputStyleSchema>;
export type OutputStyleDeletePayload = z.infer<typeof outputStyleDeleteSchema>;
export type OutputStyleCreatePayload = z.infer<typeof outputStyleCreateSchema>;
export type OutputStyleUpdatePayload = z.infer<typeof outputStyleUpdateSchema>;
export type OutputStyleReadPayload = z.infer<typeof outputStyleReadSchema>;
export type OutputStyleMoveToGroupPayload = z.infer<typeof outputStyleMoveToGroupSchema>;
