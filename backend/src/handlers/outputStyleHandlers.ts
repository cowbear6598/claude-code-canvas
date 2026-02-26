import { WebSocketResponseEvents } from '../schemas';
import type {
  PodBindOutputStylePayload,
  PodUnbindOutputStylePayload,
  OutputStyleDeletePayload,
  OutputStyleMoveToGroupPayload,
} from '../schemas';
import { outputStyleService } from '../services/outputStyleService.js';
import { podStore } from '../services/podStore.js';
import { noteStore } from '../services/noteStores.js';
import { handleResourceDelete } from '../utils/handlerHelpers.js';
import { createResourceHandlers } from './factories/createResourceHandlers.js';
import { createBindHandler, createUnbindHandler } from './factories/createBindHandlers.js';
import { createMoveToGroupHandler } from './factories/createMoveToGroupHandler.js';
import { GROUP_TYPES } from '../types';

const resourceHandlers = createResourceHandlers({
  service: outputStyleService,
  events: {
    listResult: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
    created: WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    updated: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED,
    readResult: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT,
  },
  resourceName: 'OutputStyle',
  responseKey: 'outputStyle',
  listResponseKey: 'styles',
  idField: 'outputStyleId',
});

export const handleOutputStyleList = resourceHandlers.handleList;
export const handleOutputStyleCreate = resourceHandlers.handleCreate;
export const handleOutputStyleUpdate = resourceHandlers.handleUpdate;
export const handleOutputStyleRead = resourceHandlers.handleRead;

const outputStyleBindConfig = {
  resourceName: 'OutputStyle',
  idField: 'outputStyleId',
  isMultiBind: false,
  service: outputStyleService,
  podStoreMethod: {
    bind: (canvasId: string, podId: string, outputStyleId: string): void => podStore.setOutputStyleId(canvasId, podId, outputStyleId),
    unbind: (canvasId: string, podId: string): void => podStore.setOutputStyleId(canvasId, podId, null),
  },
  getPodResourceIds: (pod: { outputStyleId: string | null }): string | null => pod.outputStyleId,
  skipConflictCheck: true,
  skipRepositorySync: true,
  events: {
    bound: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
    unbound: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
  },
};

const outputStyleBindHandler = createBindHandler(outputStyleBindConfig);
const outputStyleUnbindHandler = createUnbindHandler(outputStyleBindConfig);

export async function handlePodBindOutputStyle(
  connectionId: string,
  payload: PodBindOutputStylePayload,
  requestId: string
): Promise<void> {
  return outputStyleBindHandler(connectionId, payload, requestId);
}

export async function handlePodUnbindOutputStyle(
  connectionId: string,
  payload: PodUnbindOutputStylePayload,
  requestId: string
): Promise<void> {
  return outputStyleUnbindHandler(connectionId, payload, requestId);
}

export async function handleOutputStyleDelete(
  connectionId: string,
  payload: OutputStyleDeletePayload,
  requestId: string
): Promise<void> {
  const { outputStyleId } = payload;

  await handleResourceDelete({
    connectionId,
    requestId,
    resourceId: outputStyleId,
    resourceName: 'OutputStyle',
    responseEvent: WebSocketResponseEvents.OUTPUT_STYLE_DELETED,
    existsCheck: () => outputStyleService.exists(outputStyleId),
    findPodsUsing: (canvasId: string) => podStore.findByOutputStyleId(canvasId, outputStyleId),
    deleteNotes: (canvasId: string) => noteStore.deleteByForeignKey(canvasId, outputStyleId),
    deleteResource: () => outputStyleService.delete(outputStyleId),
    idFieldName: 'outputStyleId',
  });
}

const outputStyleMoveToGroupHandler = createMoveToGroupHandler({
  service: outputStyleService,
  resourceName: 'OutputStyle',
  idField: 'itemId',
  groupType: GROUP_TYPES.OUTPUT_STYLE,
  events: {
    moved: WebSocketResponseEvents.OUTPUT_STYLE_MOVED_TO_GROUP,
  },
});

export async function handleOutputStyleMoveToGroup(
  connectionId: string,
  payload: OutputStyleMoveToGroupPayload,
  requestId: string
): Promise<void> {
  return outputStyleMoveToGroupHandler(connectionId, payload, requestId);
}
