import { z } from 'zod';
import { createHandlerDefinition, type HandlerGroup, type HandlerDefinition } from '../registry.js';
import type { ValidatedHandler } from '../../middleware/wsMiddleware.js';

/**
 * Handler 定義配置
 */
export interface HandlerConfig<TSchema extends z.ZodType = z.ZodType> {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: ValidatedHandler<any>;
  schema: TSchema;
  responseEvent: string;
}

/**
 * 建立 Handler Group
 */
export function createHandlerGroup<const TConfig extends { name: string; handlers: readonly HandlerConfig[] }>(
  config: TConfig
): HandlerGroup {
  return {
    name: config.name,
    handlers: config.handlers.map((h): HandlerDefinition =>
      createHandlerDefinition(h.event, h.handler, h.schema, h.responseEvent)
    ),
  };
}
