import type { WebSocketResponseEvents } from '../../schemas';
import { socketService } from '../../services/socketService.js';
import { emitError } from '../../utils/websocketResponse.js';
import { logger, type LogCategory } from '../../utils/logger.js';

interface ResourceService<T = { id: string; name: string }> {
  exists(id: string): Promise<boolean>;
  create(name: string, content: string): Promise<T>;
  update(id: string, content: string): Promise<T>;
  getContent?(id: string): Promise<string | null>;
}

interface ResourceHandlerConfig<T = { id: string; name: string }> {
  service: ResourceService<T>;
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

export function createResourceHandlers<T extends { id: string; name: string }>(config: ResourceHandlerConfig<T>): {
  handleCreate: (connectionId: string, payload: CreateResourcePayload, requestId: string) => Promise<void>;
  handleUpdate: (connectionId: string, payload: UpdateResourcePayload, requestId: string) => Promise<void>;
  handleRead?: (connectionId: string, payload: ReadResourcePayload, requestId: string) => Promise<void>;
} {
  const { service, events, resourceName, responseKey, idField } = config;

  async function handleCreate(
    connectionId: string,
    payload: CreateResourcePayload,
    requestId: string
  ): Promise<void> {
    const { name, content } = payload;

    const exists = await service.exists(name);
    if (exists) {
      emitError(
        connectionId,
        events.created,
        `${resourceName} 已存在: ${name}`,
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

    socketService.emitToAll(events.created, response);

    logger.log(resourceName, 'Create', `Created ${resourceName.toLowerCase()} ${resource.id}`);
  }

  async function handleUpdate(
    connectionId: string,
    payload: UpdateResourcePayload,
    requestId: string
  ): Promise<void> {
    const { content, ...rest } = payload;
    const resourceId = rest[idField] as string;

    const exists = await service.exists(resourceId);
    if (!exists) {
      emitError(
        connectionId,
        events.updated,
        `${resourceName} 找不到: ${resourceId}`,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    const resource = await service.update(resourceId, content);

    const response: BaseResponse & { [key: string]: unknown } = {
      requestId,
      success: true,
      [responseKey]: {
        id: resource.id,
        name: resource.name,
      },
    };

    socketService.emitToAll(events.updated, response);

    logger.log(resourceName, 'Update', `Updated ${resourceName.toLowerCase()} ${resourceId}`);
  }

  let handleRead: ((connectionId: string, payload: ReadResourcePayload, requestId: string) => Promise<void>) | undefined;

  if (service.getContent && events.readResult) {
    handleRead = async function (
      connectionId: string,
      payload: ReadResourcePayload,
      requestId: string
    ): Promise<void> {
      const resourceId = payload[idField] as string;

      const content = await service.getContent!(resourceId);
      if (!content) {
        emitError(
          connectionId,
          events.readResult!,
          `${resourceName} 找不到: ${resourceId}`,
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

      socketService.emitToConnection(connectionId, events.readResult!, response);
    };
  }

  return {
    handleCreate,
    handleUpdate,
    ...(handleRead && { handleRead }),
  };
}
