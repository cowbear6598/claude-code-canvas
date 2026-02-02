import { z } from 'zod';

export const canvasCreateSchema = z.object({
  requestId: z.string(),
  name: z.string().trim().min(1, 'Canvas name cannot be empty'),
});

export const canvasListSchema = z.object({
  requestId: z.string(),
});

export const canvasRenameSchema = z.object({
  requestId: z.string(),
  canvasId: z.string(),
  newName: z.string().trim().min(1, 'Canvas name cannot be empty'),
});

export const canvasDeleteSchema = z.object({
  requestId: z.string(),
  canvasId: z.string(),
});

export const canvasSwitchSchema = z.object({
  requestId: z.string(),
  canvasId: z.string(),
});
