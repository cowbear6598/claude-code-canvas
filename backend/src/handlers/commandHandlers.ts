import {WebSocketResponseEvents} from '../schemas';
import type {CommandListResultPayload} from '../types';
import type {
    CommandListPayload,
    PodBindCommandPayload,
    PodUnbindCommandPayload,
    CommandDeletePayload,
    CommandMoveToGroupPayload,
} from '../schemas';
import {commandService} from '../services/commandService.js';
import {commandNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {emitSuccess} from '../utils/websocketResponse.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createResourceHandlers} from './factories/createResourceHandlers.js';
import {createBindHandler, createUnbindHandler} from './factories/createBindHandlers.js';
import {handleResourceDelete} from '../utils/handlerHelpers.js';
import {createMoveToGroupHandler} from './factories/createMoveToGroupHandler.js';
import {GROUP_TYPES} from '../types';

const commandNoteHandlers = createNoteHandlers({
    noteStore: commandNoteStore,
    events: {
        created: WebSocketResponseEvents.COMMAND_NOTE_CREATED,
        listResult: WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT,
        updated: WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.COMMAND_NOTE_DELETED,
    },
    foreignKeyField: 'commandId',
    entityName: 'Command',
});

export const handleCommandNoteCreate = commandNoteHandlers.handleNoteCreate;
export const handleCommandNoteList = commandNoteHandlers.handleNoteList;
export const handleCommandNoteUpdate = commandNoteHandlers.handleNoteUpdate;
export const handleCommandNoteDelete = commandNoteHandlers.handleNoteDelete;

const resourceHandlers = createResourceHandlers({
    service: commandService,
    events: {
        listResult: WebSocketResponseEvents.COMMAND_LIST_RESULT,
        created: WebSocketResponseEvents.COMMAND_CREATED,
        updated: WebSocketResponseEvents.COMMAND_UPDATED,
        readResult: WebSocketResponseEvents.COMMAND_READ_RESULT,
    },
    resourceName: 'Command',
    responseKey: 'command',
    idField: 'commandId',
});

export const handleCommandCreate = resourceHandlers.handleCreate;
export const handleCommandUpdate = resourceHandlers.handleUpdate;
export const handleCommandRead = resourceHandlers.handleRead!;

export async function handleCommandList(
    connectionId: string,
    _: CommandListPayload,
    requestId: string
): Promise<void> {
    const commands = await commandService.list();

    const response: CommandListResultPayload = {
        requestId,
        success: true,
        commands,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.COMMAND_LIST_RESULT, response);
}

// 使用工廠函數建立 Command 綁定/解綁處理器
const commandBindHandler = createBindHandler({
    resourceName: 'Command',
    idField: 'commandId',
    isMultiBind: false,
    service: commandService,
    podStoreMethod: {
        bind: (canvasId, podId, commandId) => podStore.setCommandId(canvasId, podId, commandId),
        unbind: (canvasId, podId) => podStore.setCommandId(canvasId, podId, null),
    },
    getPodResourceIds: (pod) => pod.commandId,
    copyResourceToPod: (commandId, podId, workspacePath) => commandService.copyCommandToPod(commandId, podId, workspacePath),
    deleteResourceFromPath: (workspacePath) => commandService.deleteCommandFromPath(workspacePath),
    events: {
        bound: WebSocketResponseEvents.POD_COMMAND_BOUND,
        unbound: WebSocketResponseEvents.POD_COMMAND_UNBOUND,
    },
});

const commandUnbindHandler = createUnbindHandler({
    resourceName: 'Command',
    idField: 'commandId',
    isMultiBind: false,
    service: commandService,
    podStoreMethod: {
        bind: (canvasId, podId, commandId) => podStore.setCommandId(canvasId, podId, commandId),
        unbind: (canvasId, podId) => podStore.setCommandId(canvasId, podId, null),
    },
    getPodResourceIds: (pod) => pod.commandId,
    copyResourceToPod: (commandId, podId, workspacePath) => commandService.copyCommandToPod(commandId, podId, workspacePath),
    deleteResourceFromPath: (workspacePath) => commandService.deleteCommandFromPath(workspacePath),
    events: {
        bound: WebSocketResponseEvents.POD_COMMAND_BOUND,
        unbound: WebSocketResponseEvents.POD_COMMAND_UNBOUND,
    },
});

export async function handlePodBindCommand(
    connectionId: string,
    payload: PodBindCommandPayload,
    requestId: string
): Promise<void> {
    return commandBindHandler(connectionId, payload, requestId);
}

export async function handlePodUnbindCommand(
    connectionId: string,
    payload: PodUnbindCommandPayload,
    requestId: string
): Promise<void> {
    return commandUnbindHandler(connectionId, payload, requestId);
}

export async function handleCommandDelete(
    connectionId: string,
    payload: CommandDeletePayload,
    requestId: string
): Promise<void> {
    const {commandId} = payload;

    await handleResourceDelete({
        connectionId,
        requestId,
        resourceId: commandId,
        resourceName: 'Command',
        responseEvent: WebSocketResponseEvents.COMMAND_DELETED,
        existsCheck: () => commandService.exists(commandId),
        findPodsUsing: (canvasId: string) => podStore.findByCommandId(canvasId, commandId),
        deleteNotes: (canvasId: string) => commandNoteStore.deleteByForeignKey(canvasId, commandId),
        deleteResource: () => commandService.delete(commandId),
    });
}

const commandMoveToGroupHandler = createMoveToGroupHandler({
    service: commandService,
    resourceName: 'Command',
    idField: 'itemId',
    groupType: GROUP_TYPES.COMMAND,
    events: {
        moved: WebSocketResponseEvents.COMMAND_MOVED_TO_GROUP,
    },
});

export async function handleCommandMoveToGroup(
    connectionId: string,
    payload: CommandMoveToGroupPayload,
    requestId: string
): Promise<void> {
    return commandMoveToGroupHandler(connectionId, payload, requestId);
}
