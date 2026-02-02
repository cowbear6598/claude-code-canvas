import type {Socket} from 'socket.io';
import type {Pod, WebSocketResponseEvents} from '../types/index.js';
import {podStore} from '../services/podStore.js';
import {canvasStore} from '../services/canvasStore.js';
import {emitError, emitSuccess} from './websocketResponse.js';
import {logger, type LogCategory} from './logger.js';

export function getCanvasId(
    socket: Socket,
    responseEvent: WebSocketResponseEvents,
    requestId: string
): string | undefined {
    const canvasId = canvasStore.getActiveCanvas(socket.id);

    if (!canvasId) {
        emitError(socket, responseEvent, 'No active canvas', requestId, undefined, 'INTERNAL_ERROR');
        return undefined;
    }

    return canvasId;
}

export function validatePod(
    socket: Socket,
    podId: string,
    responseEvent: WebSocketResponseEvents,
    requestId: string
): Pod | undefined {
    const canvasId = getCanvasId(socket, responseEvent, requestId);
    if (!canvasId) {
        return undefined;
    }

    const pod = podStore.getById(canvasId, podId);

    if (!pod) {
        emitError(socket, responseEvent, `Pod not found: ${podId}`, requestId, podId, 'NOT_FOUND');
        return undefined;
    }

    return pod;
}

interface ResourceDeleteConfig {
    socket: Socket;
    requestId: string;
    resourceId: string;
    resourceName: LogCategory;
    responseEvent: WebSocketResponseEvents;
    existsCheck: () => Promise<boolean>;
    findPodsUsing: (canvasId: string) => Pod[];
    deleteNotes: (canvasId: string) => string[];
    deleteResource: () => Promise<void>;
}

export async function handleResourceDelete(config: ResourceDeleteConfig): Promise<void> {
    const {
        socket,
        requestId,
        resourceId,
        resourceName,
        responseEvent,
        existsCheck,
        findPodsUsing,
        deleteNotes,
        deleteResource,
    } = config;

    const canvasId = getCanvasId(socket, responseEvent, requestId);
    if (!canvasId) {
        return;
    }

    const exists = await existsCheck();
    if (!exists) {
        emitError(
            socket,
            responseEvent,
            `${resourceName} not found: ${resourceId}`,
            requestId,
            undefined,
            'NOT_FOUND'
        );
        return;
    }

    const podsUsing = findPodsUsing(canvasId);
    if (podsUsing.length > 0) {
        const podNames = podsUsing.map((pod) => pod.name).join(', ');

        emitError(
            socket,
            responseEvent,
            `${resourceName} is in use by pods: ${podNames}`,
            requestId,
            undefined,
            'IN_USE'
        );
        return;
    }

    const deletedNoteIds = deleteNotes(canvasId);
    await deleteResource();

    const response = {
        requestId,
        success: true,
        [resourceId.includes('Style') ? 'outputStyleId' : `${resourceName.toLowerCase()}Id`]: resourceId,
        deletedNoteIds,
    };

    emitSuccess(socket, responseEvent, response);

    logger.log(resourceName, 'Delete', `Deleted ${resourceName.toLowerCase()} ${resourceId} and ${deletedNoteIds.length} notes`);
}
