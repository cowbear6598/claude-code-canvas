import { z } from 'zod';
import { requestIdSchema } from './base.js';

export const timeTriggerFrequencySchema = z.enum([
  'every-second',
  'every-x-minute',
  'every-x-hour',
  'every-day',
  'every-week',
]);

export const timeTriggerConfigSchema = z.object({
  frequency: timeTriggerFrequencySchema,
  second: z.number().int().min(0).max(59),
  intervalMinute: z.number().int().min(1).max(1440),
  intervalHour: z.number().int().min(1).max(24),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  weekdays: z.array(z.number().int().min(0).max(6)),
});

export const triggerCreateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().min(1).max(50),
  type: z.literal('time'),
  config: timeTriggerConfigSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  enabled: z.boolean().default(true),
});

export const triggerListSchema = z.object({
  requestId: requestIdSchema,
});

export const triggerUpdateSchema = z.object({
  requestId: requestIdSchema,
  triggerId: z.uuid(),
  name: z.string().min(1).max(50).optional(),
  type: z.literal('time').optional(),
  config: timeTriggerConfigSchema.optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  enabled: z.boolean().optional(),
});

export const triggerDeleteSchema = z.object({
  requestId: requestIdSchema,
  triggerId: z.uuid(),
});

export type TriggerCreatePayload = z.infer<typeof triggerCreateSchema>;
export type TriggerListPayload = z.infer<typeof triggerListSchema>;
export type TriggerUpdatePayload = z.infer<typeof triggerUpdateSchema>;
export type TriggerDeletePayload = z.infer<typeof triggerDeleteSchema>;
