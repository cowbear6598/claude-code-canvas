import { z } from 'zod';

export const requestIdSchema = z.uuid();
export const podIdSchema = z.uuid();
export const canvasIdSchema = z.string();
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
