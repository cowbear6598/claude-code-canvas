import { z } from 'zod';

// cursor:move 是純廣播事件（fire-and-forget），不需要 requestId
export const cursorMoveSchema = z.object({
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
});

export type CursorMovePayload = z.infer<typeof cursorMoveSchema>;
