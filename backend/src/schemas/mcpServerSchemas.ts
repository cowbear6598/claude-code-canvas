import {z} from 'zod';
import {requestIdSchema, podIdSchema, canvasIdSchema, resourceIdSchema, noteUpdateBaseSchema, createNoteCreateSchema, canvasRequestSchema, noteDeleteBaseSchema, podUnbindBaseSchema} from './base.js';

const stdioMcpServerConfigSchema = z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
});

const httpMcpServerConfigSchema = z.object({
    type: z.enum(['http', 'sse']),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
});

const mcpServerConfigSchema = z.union([stdioMcpServerConfigSchema, httpMcpServerConfigSchema]);

export const mcpServerListSchema = canvasRequestSchema;

export const mcpServerCreateSchema = z.object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    name: resourceIdSchema,
    config: mcpServerConfigSchema,
});

export const mcpServerUpdateSchema = z.object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    mcpServerId: z.uuid(),
    name: resourceIdSchema,
    config: mcpServerConfigSchema,
});

export const mcpServerReadSchema = z.object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    mcpServerId: z.uuid(),
});

export const mcpServerDeleteSchema = z.object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    mcpServerId: z.uuid(),
});

export const mcpServerNoteCreateSchema = createNoteCreateSchema({ mcpServerId: z.uuid() });

export const mcpServerNoteListSchema = canvasRequestSchema;

export const mcpServerNoteUpdateSchema = noteUpdateBaseSchema;

export const mcpServerNoteDeleteSchema = noteDeleteBaseSchema;

export const podBindMcpServerSchema = z.object({
    requestId: requestIdSchema,
    canvasId: canvasIdSchema,
    podId: podIdSchema,
    mcpServerId: z.uuid(),
});

export const podUnbindMcpServerSchema = z.object({
    ...podUnbindBaseSchema.shape,
    mcpServerId: z.uuid(),
});

export type McpServerListPayload = z.infer<typeof mcpServerListSchema>;
export type McpServerCreatePayload = z.infer<typeof mcpServerCreateSchema>;
export type McpServerUpdatePayload = z.infer<typeof mcpServerUpdateSchema>;
export type McpServerReadPayload = z.infer<typeof mcpServerReadSchema>;
export type McpServerDeletePayload = z.infer<typeof mcpServerDeleteSchema>;
export type McpServerNoteCreatePayload = z.infer<typeof mcpServerNoteCreateSchema>;
export type McpServerNoteListPayload = z.infer<typeof mcpServerNoteListSchema>;
export type McpServerNoteUpdatePayload = z.infer<typeof mcpServerNoteUpdateSchema>;
export type McpServerNoteDeletePayload = z.infer<typeof mcpServerNoteDeleteSchema>;
export type PodBindMcpServerPayload = z.infer<typeof podBindMcpServerSchema>;
export type PodUnbindMcpServerPayload = z.infer<typeof podUnbindMcpServerSchema>;
