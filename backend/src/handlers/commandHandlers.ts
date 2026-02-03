import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type CommandListResultPayload,
} from '../types/index.js';
import type {
    CommandListPayload,
    PodBindCommandPayload,
    PodUnbindCommandPayload,
    CommandDeletePayload,
} from '../schemas/index.js';
import {commandService} from '../services/commandService.js';
import {commandNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {emitSuccess} from '../utils/websocketResponse.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createResourceHandlers} from './factories/createResourceHandlers.js';
import {createBindHandler, createUnbindHandler} from './factories/createBindHandlers.js';
import {handleResourceDelete} from '../utils/handlerHelpers.js';

const commandNoteHandlers = createNoteHandlers({
    noteStore: commandNoteStore,
    events: {
        created: WebSocketResponseEvents.COMMAND_NOTE_CREATED,
        listResult: WebSocketResponseEvents.COMMAND_NOTE_LIST_RESULT,
        updated: WebSocketResponseEvents.COMMAND_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.COMMAND_NOTE_DELETED,
    },
    broadcastEvents: {
        created: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_CREATED,
        updated: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_DELETED,
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
    broadcastEvents: {
        created: WebSocketResponseEvents.BROADCAST_COMMAND_CREATED,
        updated: WebSocketResponseEvents.BROADCAST_COMMAND_UPDATED,
    },
    resourceName: 'Command',
    responseKey: 'command',
    idField: 'commandId',
});

export const handleCommandCreate = resourceHandlers.handleCreate;
export const handleCommandUpdate = resourceHandlers.handleUpdate;
export const handleCommandRead = resourceHandlers.handleRead!;

export async function handleCommandList(
    socket: Socket,
    _: CommandListPayload,
    requestId: string
): Promise<void> {
    const commands = await commandService.list();

    const response: CommandListResultPayload = {
        requestId,
        success: true,
        commands,
    };

    emitSuccess(socket, WebSocketResponseEvents.COMMAND_LIST_RESULT, response);
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
        broadcastBound: WebSocketResponseEvents.BROADCAST_POD_COMMAND_BOUND,
        broadcastUnbound: WebSocketResponseEvents.BROADCAST_POD_COMMAND_UNBOUND,
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
        broadcastBound: WebSocketResponseEvents.BROADCAST_POD_COMMAND_BOUND,
        broadcastUnbound: WebSocketResponseEvents.BROADCAST_POD_COMMAND_UNBOUND,
    },
});

export async function handlePodBindCommand(
    socket: Socket,
    payload: PodBindCommandPayload,
    requestId: string
): Promise<void> {
    return commandBindHandler(socket, payload, requestId);
}

export async function handlePodUnbindCommand(
    socket: Socket,
    payload: PodUnbindCommandPayload,
    requestId: string
): Promise<void> {
    return commandUnbindHandler(socket, payload, requestId);
}

export async function handleCommandDelete(
    socket: Socket,
    payload: CommandDeletePayload,
    requestId: string
): Promise<void> {
    const {commandId} = payload;

    await handleResourceDelete({
        socket,
        requestId,
        resourceId: commandId,
        resourceName: 'Command',
        responseEvent: WebSocketResponseEvents.COMMAND_DELETED,
        broadcastEvent: WebSocketResponseEvents.BROADCAST_COMMAND_DELETED,
        existsCheck: () => commandService.exists(commandId),
        findPodsUsing: (canvasId: string) => podStore.findByCommandId(canvasId, commandId),
        deleteNotes: (canvasId: string) => commandNoteStore.deleteByForeignKey(canvasId, commandId),
        deleteResource: () => commandService.delete(commandId),
    });
}
