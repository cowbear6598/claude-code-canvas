import type { WebSocketResponseEvents } from '../../schemas';
import type { Pod } from '../../types/index.js';
import { socketService } from '../../services/socketService.js';
import { emitError } from '../../utils/websocketResponse.js';
import { logger, type LogCategory } from '../../utils/logger.js';
import { handleResourceDelete } from '../../utils/handlerHelpers.js';

interface ResourceService<T = { id: string; name: string }> {
  list(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
  create(name: string, content: string): Promise<T>;
  update(id: string, content: string): Promise<T>;
  getContent(id: string): Promise<string | null>;
  delete(id: string): Promise<void>;
}

export interface DeleteResourcePayload {
  [key: string]: unknown;
}

interface DeleteHandlerConfig {
  deleted: WebSocketResponseEvents;
  findPodsUsing: (canvasId: string, resourceId: string) => Pod[];
  deleteNotes: (canvasId: string, resourceId: string) => string[];
  idFieldName?: string;
}

interface ResourceHandlerConfig<T = { id: string; name: string }> {
  service: ResourceService<T>;
  events: {
    listResult: WebSocketResponseEvents;
    created: WebSocketResponseEvents;
    updated: WebSocketResponseEvents;
    readResult: WebSocketResponseEvents;
    deleted?: DeleteHandlerConfig;
  };
  resourceName: LogCategory;
  responseKey: string;
  listResponseKey: string;
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

export function createListHandler<T>(config: {
  service: { list(): Promise<T[]> };
  event: WebSocketResponseEvents;
  responseKey: string;
}): (connectionId: string, payload: unknown, requestId: string) => Promise<void> {
  return async function (connectionId: string, _: unknown, requestId: string): Promise<void> {
    const items = await config.service.list();

    // [key: string]: unknown — computed property key（config.responseKey）的 TypeScript 限制，
    // 無法用字面量型別約束。response 物件僅用於序列化傳送，不再讀取。
    const response: BaseResponse & { [key: string]: unknown } = {
      requestId,
      success: true,
      [config.responseKey]: items,
    };

    socketService.emitToConnection(connectionId, config.event, response);
  };
}

export function createResourceHandlers<T extends { id: string; name: string }>(config: ResourceHandlerConfig<T>): {
  handleList: (connectionId: string, payload: unknown, requestId: string) => Promise<void>;
  handleCreate: (connectionId: string, payload: CreateResourcePayload, requestId: string) => Promise<void>;
  handleUpdate: (connectionId: string, payload: UpdateResourcePayload, requestId: string) => Promise<void>;
  handleRead: (connectionId: string, payload: ReadResourcePayload, requestId: string) => Promise<void>;
  handleDelete: (connectionId: string, payload: DeleteResourcePayload, requestId: string) => Promise<void>;
} {
  const { service, events, resourceName, responseKey, listResponseKey, idField } = config;

  const handleList = createListHandler({
    service,
    event: events.listResult,
    responseKey: listResponseKey,
  });

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

    socketService.emitToConnection(connectionId, events.created, response);

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

    socketService.emitToConnection(connectionId, events.updated, response);

    logger.log(resourceName, 'Update', `Updated ${resourceName.toLowerCase()} ${resourceId}`);
  }

  async function handleRead(
    connectionId: string,
    payload: ReadResourcePayload,
    requestId: string
  ): Promise<void> {
    const resourceId = payload[idField] as string;

    const content = await service.getContent(resourceId);
    if (!content) {
      emitError(
        connectionId,
        events.readResult,
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

    socketService.emitToConnection(connectionId, events.readResult, response);
  }

  async function handleDelete(
    connectionId: string,
    payload: DeleteResourcePayload,
    requestId: string
  ): Promise<void> {
    if (!events.deleted) {
      return;
    }

    const resourceId = payload[idField] as string;
    const deleteConfig = events.deleted;

    await handleResourceDelete({
      connectionId,
      requestId,
      resourceId,
      resourceName,
      responseEvent: deleteConfig.deleted,
      existsCheck: () => service.exists(resourceId),
      findPodsUsing: (canvasId: string) => deleteConfig.findPodsUsing(canvasId, resourceId),
      deleteNotes: (canvasId: string) => deleteConfig.deleteNotes(canvasId, resourceId),
      deleteResource: () => service.delete(resourceId),
      idFieldName: deleteConfig.idFieldName,
    });
  }

  return {
    handleList,
    handleCreate,
    handleUpdate,
    handleRead,
    handleDelete,
  };
}
