import type {Socket} from 'socket.io';
import type {Pod, WebSocketResponseEvents} from '../types/index.js';
import {podStore} from '../services/podStore.js';
import {canvasStore} from '../services/canvasStore.js';
import {socketService} from '../services/socketService.js';
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
    broadcastEvent?: WebSocketResponseEvents;
    existsCheck: () => Promise<boolean>;
    findPodsUsing: (canvasId: string) => Pod[];
    deleteNotes: (canvasId: string) => string[];
    deleteResource: () => Promise<void>;
    idFieldName?: string;
}

export async function handleResourceDelete(config: ResourceDeleteConfig): Promise<void> {
    const {
        socket,
        requestId,
        resourceId,
        resourceName,
        responseEvent,
        broadcastEvent,
        existsCheck,
        findPodsUsing,
        deleteNotes,
        deleteResource,
        idFieldName,
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
        emitError(
            socket,
            responseEvent,
            `${resourceName} 正在被 ${podsUsing.length} 個 Pod 使用中，無法刪除`,
            requestId,
            undefined,
            'IN_USE'
        );
        return;
    }

    const deletedNoteIds = deleteNotes(canvasId);
    await deleteResource();

    const fieldName = idFieldName ?? `${resourceName.toLowerCase()}Id`;
    const response = {
        requestId,
        success: true,
        [fieldName]: resourceId,
        deletedNoteIds,
    };

    emitSuccess(socket, responseEvent, response);

    if (broadcastEvent) {
        const broadcastPayload = {
            canvasId,
            [fieldName]: resourceId,
            deletedNoteIds,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, broadcastEvent, broadcastPayload);
    }

    logger.log(resourceName, 'Delete', `Deleted ${resourceName.toLowerCase()} ${resourceId} and ${deletedNoteIds.length} notes`);
}
