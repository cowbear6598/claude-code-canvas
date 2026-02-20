import { z } from 'zod';

export const requestIdSchema = z.uuid();
export const podIdSchema = z.uuid();
export const canvasIdSchema = z.uuid();
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export const resourceNameSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, '名稱只允許英文字母、數字、底線（_）、連字號（-）')
  .min(1)
  .max(100);
