import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type TriggerCreatedPayload,
  type TriggerListResultPayload,
  type TriggerUpdatedPayload,
  type TriggerDeletedPayload,
} from '../types/index.js';
import type {
  TriggerCreatePayload,
  TriggerListPayload,
  TriggerUpdatePayload,
  TriggerDeletePayload,
} from '../schemas/index.js';
import { triggerStore } from '../services/triggerStore.js';
import { connectionStore } from '../services/connectionStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleTriggerCreate(
  socket: Socket,
  payload: TriggerCreatePayload,
  requestId: string
): Promise<void> {
  const { name, type, config, x, y, rotation, enabled } = payload;

  const trigger = triggerStore.create({
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

  logger.log('Trigger', 'Create', `Created trigger ${trigger.id} (${name})`);
}

export async function handleTriggerList(
  socket: Socket,
  _: TriggerListPayload,
  requestId: string
): Promise<void> {
  const triggers = triggerStore.list();

  const response: TriggerListResultPayload = {
    requestId,
    success: true,
    triggers,
  };

  emitSuccess(socket, WebSocketResponseEvents.TRIGGER_LIST_RESULT, response);
}

export async function handleTriggerUpdate(
  socket: Socket,
  payload: TriggerUpdatePayload,
  requestId: string
): Promise<void> {
  const { triggerId, name, type, config, x, y, rotation, enabled } = payload;

  const trigger = triggerStore.getById(triggerId);
  if (!trigger) {
    emitError(
      socket,
      WebSocketResponseEvents.TRIGGER_UPDATED,
      `Trigger not found: ${triggerId}`,
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

  const updatedTrigger = triggerStore.update(triggerId, updates);

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

  logger.log('Trigger', 'Update', `Updated trigger ${triggerId}`);
}

export async function handleTriggerDelete(
  socket: Socket,
  payload: TriggerDeletePayload,
  requestId: string
): Promise<void> {
  const { triggerId } = payload;

  const trigger = triggerStore.getById(triggerId);
  if (!trigger) {
    emitError(
      socket,
      WebSocketResponseEvents.TRIGGER_DELETED,
      `Trigger not found: ${triggerId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const deletedConnectionIds = connectionStore.deleteByTriggerId(triggerId);

  const deleted = triggerStore.delete(triggerId);

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

  logger.log('Trigger', 'Delete', `Deleted trigger ${triggerId} and ${deletedConnectionIds.length} connections`);
}
