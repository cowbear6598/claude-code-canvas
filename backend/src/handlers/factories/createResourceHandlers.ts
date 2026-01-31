import type { Socket } from 'socket.io';
import type { WebSocketResponseEvents } from '../../types/index.js';
import { emitSuccess, emitError } from '../../utils/websocketResponse.js';
import { logger, type LogCategory } from '../../utils/logger.js';

interface ResourceService {
  exists(id: string): Promise<boolean>;
  create(name: string, content: string): Promise<{ id: string; name: string }>;
  update(id: string, content: string): Promise<void>;
  getContent?(id: string): Promise<string | null>;
}

interface ResourceHandlerConfig {
  service: ResourceService;
  events: {
    listResult: WebSocketResponseEvents;
    created: WebSocketResponseEvents;
    updated: WebSocketResponseEvents;
    readResult?: WebSocketResponseEvents;
  };
  resourceName: LogCategory;
  responseKey: string;
  idField: string;
}

export interface CreateResourcePayload {
  name: string;
  content: string;
}

export interface UpdateResourcePayload {
  content: string;
  [key: string]: unknown;
}

export interface ReadResourcePayload {
  [key: string]: unknown;
}

interface BaseResponse {
  requestId: string;
  success: true;
}

export function createResourceHandlers(config: ResourceHandlerConfig): {
  handleCreate: (socket: Socket, payload: CreateResourcePayload, requestId: string) => Promise<void>;
  handleUpdate: (socket: Socket, payload: UpdateResourcePayload, requestId: string) => Promise<void>;
  handleRead?: (socket: Socket, payload: ReadResourcePayload, requestId: string) => Promise<void>;
} {
  const { service, events, resourceName, responseKey, idField } = config;

  async function handleCreate(
    socket: Socket,
    payload: CreateResourcePayload,
    requestId: string
  ): Promise<void> {
    const { name, content } = payload;

    const exists = await service.exists(name);
    if (exists) {
      emitError(
        socket,
        events.created,
        `${resourceName} already exists: ${name}`,
        requestId,
        undefined,
        'ALREADY_EXISTS'
      );
      return;
    }

    const resource = await service.create(name, content);

    const response: BaseResponse & { [key: string]: unknown } = {
      requestId,
      success: true,
      [responseKey]: resource,
    };

    emitSuccess(socket, events.created, response);

    logger.log(resourceName, 'Create', `Created ${resourceName.toLowerCase()} ${resource.id}`);
  }

  async function handleUpdate(
    socket: Socket,
    payload: UpdateResourcePayload,
    requestId: string
  ): Promise<void> {
    const { content, ...rest } = payload;
    const resourceId = rest[idField] as string;

    const exists = await service.exists(resourceId);
    if (!exists) {
      emitError(
        socket,
        events.updated,
        `${resourceName} not found: ${resourceId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    await service.update(resourceId, content);

    const response: BaseResponse = {
      requestId,
      success: true,
    };

    emitSuccess(socket, events.updated, response);

    logger.log(resourceName, 'Update', `Updated ${resourceName.toLowerCase()} ${resourceId}`);
  }

  let handleRead: ((socket: Socket, payload: ReadResourcePayload, requestId: string) => Promise<void>) | undefined;

  if (service.getContent && events.readResult) {
    handleRead = async function (
      socket: Socket,
      payload: ReadResourcePayload,
      requestId: string
    ): Promise<void> {
      const resourceId = payload[idField] as string;

      const content = await service.getContent!(resourceId);
      if (!content) {
        emitError(
          socket,
          events.readResult!,
          `${resourceName} not found: ${resourceId}`,
          requestId,
          undefined,
          'NOT_FOUND'
        );
        return;
      }

      const response: BaseResponse & { [key: string]: unknown } = {
        requestId,
        success: true,
        [responseKey]: {
          id: resourceId,
          name: resourceId,
          content,
        },
      };

      emitSuccess(socket, events.readResult!, response);
    };
  }

  return {
    handleCreate,
    handleUpdate,
    ...(handleRead && { handleRead }),
  };
}
