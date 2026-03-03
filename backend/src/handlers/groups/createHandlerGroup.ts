import { z } from 'zod';
import { createHandlerDefinition, type HandlerGroup, type HandlerDefinition } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

// 儲存層使用 ValidatedHandler<never> 搭配 method shorthand 讓 TypeScript 以雙變方式推導
// 實際型別安全由 defineHandlerConfig 在建構時保證
export interface HandlerConfig {
  event: string;
  handler(connectionId: string, payload: never, requestId: string): Promise<void>;
  schema: z.ZodType;
  responseEvent: string;
}

export function defineHandlerConfig<TSchema extends z.ZodType>(config: {
  event: string;
  handler: ValidatedHandler<z.infer<TSchema>>;
  schema: TSchema;
  responseEvent: string;
}): HandlerConfig {
  return config as unknown as HandlerConfig;
}

export function createHandlerGroup(config: { name: string; handlers: readonly HandlerConfig[] }): HandlerGroup {
  return {
    name: config.name,
    handlers: config.handlers.map((h): HandlerDefinition =>
      createHandlerDefinition(h.event, h.handler as ValidatedHandler<z.infer<typeof h.schema>>, h.schema, h.responseEvent)
    ),
  };
}
