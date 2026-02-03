import { z } from 'zod';

export const canvasCreateSchema = z.object({
  requestId: z.string(),
  name: z
    .string()
    .trim()
    .min(1, 'Canvas name cannot be empty')
    .max(50, 'Canvas name must be 50 characters or less')
    .regex(
      /^[a-zA-Z0-9_\- ]+$/,
      'Canvas name can only contain letters, numbers, underscores, hyphens, and spaces'
    ),
});

export const canvasListSchema = z.object({
  requestId: z.string(),
});

export const canvasRenameSchema = z.object({
  requestId: z.string(),
  canvasId: z.uuid('Invalid canvas ID format'),
  newName: z
    .string()
    .trim()
    .min(1, 'Canvas name cannot be empty')
    .max(50, 'Canvas name must be 50 characters or less')
    .regex(
      /^[a-zA-Z0-9_\- ]+$/,
      'Canvas name can only contain letters, numbers, underscores, hyphens, and spaces'
    ),
});

export const canvasDeleteSchema = z.object({
  requestId: z.string(),
  canvasId: z.uuid('Invalid canvas ID format'),
});

export const canvasSwitchSchema = z.object({
  requestId: z.string(),
  canvasId: z.uuid('Invalid canvas ID format'),
});

export type CanvasCreatePayload = z.infer<typeof canvasCreateSchema>;
export type CanvasListPayload = z.infer<typeof canvasListSchema>;
export type CanvasRenamePayload = z.infer<typeof canvasRenameSchema>;
export type CanvasDeletePayload = z.infer<typeof canvasDeleteSchema>;
export type CanvasSwitchPayload = z.infer<typeof canvasSwitchSchema>;
