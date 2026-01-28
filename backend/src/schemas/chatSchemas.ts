import { z } from 'zod';
import { requestIdSchema, podIdSchema } from './base.js';

export const chatSendSchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
  message: z.string().min(1).max(10000),
});

export const chatHistorySchema = z.object({
  requestId: requestIdSchema,
  podId: podIdSchema,
});

export type ChatSendPayload = z.infer<typeof chatSendSchema>;
export type ChatHistoryPayload = z.infer<typeof chatHistorySchema>;
