import { z } from "zod";
import { modelTypeSchema } from "./podSchemas.js";

export const configGetSchema = z.object({
  requestId: z.string(),
});

export const configUpdateSchema = z
  .object({
    requestId: z.string(),
    summaryModel: modelTypeSchema.optional(),
    aiDecideModel: modelTypeSchema.optional(),
    timezoneOffset: z.number().int().min(-12).max(14).optional(),
  })
  .refine(
    (data) =>
      data.summaryModel ||
      data.aiDecideModel ||
      data.timezoneOffset !== undefined,
    {
      message: "至少需要提供一個設定值",
    },
  );

export type ConfigGetPayload = z.infer<typeof configGetSchema>;
export type ConfigUpdatePayload = z.infer<typeof configUpdateSchema>;

export interface ConfigGetResultPayload {
  requestId: string;
  success: boolean;
  summaryModel?: string;
  aiDecideModel?: string;
  timezoneOffset?: number;
  error?: string;
}

export interface ConfigUpdatedPayload {
  requestId: string;
  success: boolean;
  summaryModel?: string;
  aiDecideModel?: string;
  timezoneOffset?: number;
  error?: string;
}
