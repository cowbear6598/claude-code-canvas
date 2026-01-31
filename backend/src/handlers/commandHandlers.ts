import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type CommandListResultPayload,
    type PodCommandBoundPayload,
    type PodCommandUnboundPayload,
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
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createResourceHandlers} from './factories/createResourceHandlers.js';
import {validatePod, handleResourceDelete} from '../utils/handlerHelpers.js';

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

export async function handlePodBindCommand(
    socket: Socket,
    payload: PodBindCommandPayload,
    requestId: string
): Promise<void> {
    const {podId, commandId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_COMMAND_BOUND, requestId);
    if (!pod) {
        return;
    }

    const commandExists = await commandService.exists(commandId);
    if (!commandExists) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_COMMAND_BOUND,
            `Command not found: ${commandId}`,
            requestId,
            podId,
            'NOT_FOUND'
        );
        return;
    }

    if (pod.commandId) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_COMMAND_BOUND,
            `Pod ${podId} already has command ${pod.commandId} bound. Please unbind first.`,
            requestId,
            podId,
            'CONFLICT'
        );
        return;
    }

    await commandService.copyCommandToPod(commandId, podId);

    podStore.setCommandId(podId, commandId);
    const updatedPod = podStore.getById(podId);

    const response: PodCommandBoundPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_BOUND, response);
    logger.log('Command', 'Bind', `Bound command ${commandId} to Pod ${podId}`);
}

export async function handlePodUnbindCommand(
    socket: Socket,
    payload: PodUnbindCommandPayload,
    requestId: string
): Promise<void> {
    const {podId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_COMMAND_UNBOUND, requestId);
    if (!pod) {
        return;
    }

    if (!pod.commandId) {
        const response: PodCommandUnboundPayload = {
            requestId,
            success: true,
            pod,
        };
        emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_UNBOUND, response);
        return;
    }

    await commandService.deleteCommandFromPath(pod.workspacePath);

    podStore.setCommandId(podId, null);
    const updatedPod = podStore.getById(podId);

    const response: PodCommandUnboundPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_COMMAND_UNBOUND, response);
    logger.log('Command', 'Unbind', `Unbound command from Pod ${podId}`);
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
        existsCheck: () => commandService.exists(commandId),
        findPodsUsing: () => podStore.findByCommandId(commandId),
        deleteNotes: () => commandNoteStore.deleteByForeignKey(commandId),
        deleteResource: () => commandService.delete(commandId),
    });
}
