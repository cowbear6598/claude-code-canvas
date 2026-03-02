import { z } from 'zod';
import { coordinateSchema } from './base.js';

// cursor:move 是純廣播事件（fire-and-forget），不需要 requestId
export const cursorMoveSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
});

export type CursorMovePayload = z.infer<typeof cursorMoveSchema>;
