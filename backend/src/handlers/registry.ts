import type { Socket } from 'socket.io';
import { z } from 'zod';
import { createValidatedHandler, type ValidatedHandler } from '../middleware/wsMiddleware.js';

export interface HandlerDefinition<T = unknown> {
  event: string;
  handler: ValidatedHandler<T>;
  schema: z.ZodType<T>;
  responseEvent: string;
}

export interface HandlerGroup {
  name: string;
  handlers: HandlerDefinition<unknown>[];
}

export class HandlerRegistry {
  private groups: HandlerGroup[] = [];

  registerGroup(group: HandlerGroup): void {
    this.groups.push(group);
  }

  applyToSocket(socket: Socket): void {
    for (const group of this.groups) {
      for (const definition of group.handlers) {
        const wrappedHandler = createValidatedHandler(
          definition.schema,
          definition.handler,
          definition.responseEvent
        );
        socket.on(definition.event, (payload) => wrappedHandler(socket, payload));
      }
    }
  }
}
