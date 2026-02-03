import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  TriggerCreatedPayload,
  TriggerListResultPayload,
  TriggerUpdatedPayload,
  TriggerDeletedPayload,
  BroadcastTriggerCreatedPayload,
  BroadcastTriggerUpdatedPayload,
  BroadcastTriggerDeletedPayload,
} from '../types/index.js';
import type {
  TriggerCreatePayload,
  TriggerListPayload,
  TriggerUpdatePayload,
  TriggerDeletePayload,
} from '../schemas/index.js';
import { triggerStore } from '../services/triggerStore.js';
import { connectionStore } from '../services/connectionStore.js';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { withCanvasId } from '../utils/handlerHelpers.js';

export const handleTriggerCreate = withCanvasId<TriggerCreatePayload>(
  WebSocketResponseEvents.TRIGGER_CREATED,
  async (socket: Socket, canvasId: string, payload: TriggerCreatePayload, requestId: string): Promise<void> => {
    const { name, type, config, x, y, rotation, enabled } = payload;

    const trigger = triggerStore.create(canvasId, {
      name,
      type,
      config,
      x,
      y,
      rotation,
      enabled,
    });

    const response: TriggerCreatedPayload = {
      requestId,
      success: true,
      trigger,
    };

    emitSuccess(socket, WebSocketResponseEvents.TRIGGER_CREATED, response);

    const broadcastPayload: BroadcastTriggerCreatedPayload = {
      canvasId,
      trigger,
    };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_TRIGGER_CREATED, broadcastPayload);

    logger.log('Trigger', 'Create', `Created trigger ${trigger.id} (${name})`);
  }
);

export const handleTriggerList = withCanvasId<TriggerListPayload>(
  WebSocketResponseEvents.TRIGGER_LIST_RESULT,
  async (socket: Socket, canvasId: string, _: TriggerListPayload, requestId: string): Promise<void> => {
    const triggers = triggerStore.list(canvasId);

    const response: TriggerListResultPayload = {
      requestId,
      success: true,
      triggers,
    };

    emitSuccess(socket, WebSocketResponseEvents.TRIGGER_LIST_RESULT, response);
  }
);

export const handleTriggerUpdate = withCanvasId<TriggerUpdatePayload>(
  WebSocketResponseEvents.TRIGGER_UPDATED,
  async (socket: Socket, canvasId: string, payload: TriggerUpdatePayload, requestId: string): Promise<void> => {
    const { triggerId, name, type, config, x, y, rotation, enabled } = payload;

    const trigger = triggerStore.getById(canvasId, triggerId);
    if (!trigger) {
      emitError(
        socket,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        `Trigger 找不到: ${triggerId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    const updates: Partial<{ name: string; type: 'time'; config: typeof config; x: number; y: number; rotation: number; enabled: boolean }> = {};
    if (name !== undefined) {
      updates.name = name;
    }
    if (type !== undefined) {
      updates.type = type;
    }
    if (config !== undefined) {
      updates.config = config;
    }
    if (x !== undefined) {
      updates.x = x;
    }
    if (y !== undefined) {
      updates.y = y;
    }
    if (rotation !== undefined) {
      updates.rotation = rotation;
    }
    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    const updatedTrigger = triggerStore.update(canvasId, triggerId, updates);

    if (!updatedTrigger) {
      emitError(
        socket,
        WebSocketResponseEvents.TRIGGER_UPDATED,
        `Failed to update trigger: ${triggerId}`,
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );
      return;
    }

    const response: TriggerUpdatedPayload = {
      requestId,
      success: true,
      trigger: updatedTrigger,
    };

    emitSuccess(socket, WebSocketResponseEvents.TRIGGER_UPDATED, response);

    const broadcastPayload: BroadcastTriggerUpdatedPayload = {
      canvasId,
      trigger: updatedTrigger,
    };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_TRIGGER_UPDATED, broadcastPayload);

    logger.log('Trigger', 'Update', `Updated trigger ${triggerId}`);
  }
);

export const handleTriggerDelete = withCanvasId<TriggerDeletePayload>(
  WebSocketResponseEvents.TRIGGER_DELETED,
  async (socket: Socket, canvasId: string, payload: TriggerDeletePayload, requestId: string): Promise<void> => {
    const { triggerId } = payload;

    const trigger = triggerStore.getById(canvasId, triggerId);
    if (!trigger) {
      emitError(
        socket,
        WebSocketResponseEvents.TRIGGER_DELETED,
        `Trigger 找不到: ${triggerId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    const deletedConnectionIds = connectionStore.deleteByTriggerId(canvasId, triggerId);

    const deleted = triggerStore.delete(canvasId, triggerId);

    if (!deleted) {
      emitError(
        socket,
        WebSocketResponseEvents.TRIGGER_DELETED,
        `Failed to delete trigger: ${triggerId}`,
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );
      return;
    }

    const response: TriggerDeletedPayload = {
      requestId,
      success: true,
      triggerId,
      deletedConnectionIds,
    };

    emitSuccess(socket, WebSocketResponseEvents.TRIGGER_DELETED, response);

    const broadcastPayload: BroadcastTriggerDeletedPayload = {
      canvasId,
      triggerId,
      deletedConnectionIds,
    };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_TRIGGER_DELETED, broadcastPayload);

    logger.log('Trigger', 'Delete', `Deleted trigger ${triggerId} and ${deletedConnectionIds.length} connections`);
  }
);
