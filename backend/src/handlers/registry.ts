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
    console.log(`[HandlerRegistry] Registered group: ${group.name} (${group.handlers.length} handlers)`);
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
    console.log(`[HandlerRegistry] Applied ${this.getTotalHandlers()} handlers to socket ${socket.id}`);
  }

  private getTotalHandlers(): number {
    return this.groups.reduce((total, group) => total + group.handlers.length, 0);
  }
}
