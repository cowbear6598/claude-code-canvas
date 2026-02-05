import { z } from 'zod';
import { requestIdSchema } from './base.js';

export const groupCreateSchema = z.object({
  requestId: requestIdSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['command', 'output-style', 'subagent']),
});

export const groupListSchema = z.object({
  requestId: requestIdSchema,
  type: z.enum(['command', 'output-style', 'subagent']),
});

export const groupUpdateSchema = z.object({
  requestId: requestIdSchema,
  groupId: z.string(),
  name: z.string().min(1).max(100),
});

export const groupDeleteSchema = z.object({
  requestId: requestIdSchema,
  groupId: z.string(),
});

export type GroupCreatePayload = z.infer<typeof groupCreateSchema>;
export type GroupListPayload = z.infer<typeof groupListSchema>;
export type GroupUpdatePayload = z.infer<typeof groupUpdateSchema>;
export type GroupDeletePayload = z.infer<typeof groupDeleteSchema>;
