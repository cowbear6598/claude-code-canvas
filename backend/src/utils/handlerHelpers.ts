import type {Socket} from 'socket.io';
import type {WebSocketResponseEvents} from '../schemas/index.js';
import type {Pod} from '../types/index.js';
import {podStore} from '../services/podStore.js';
import {canvasStore} from '../services/canvasStore.js';
import {socketService} from '../services/socketService.js';
import {emitError} from './websocketResponse.js';
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

// Handler 型別定義
export type HandlerWithCanvasId<TPayload = unknown> = (
    socket: Socket,
    canvasId: string,
    payload: TPayload,
    requestId: string
) => Promise<void>;

export type StandardHandler<TPayload = unknown> = (
    socket: Socket,
    payload: TPayload,
    requestId: string
) => Promise<void>;

/**
 * 將需要 canvasId 的 handler 包裝成標準 handler
 * 自動注入 canvasId，若無法取得則自動回傳錯誤
 */
export function withCanvasId<TPayload = unknown>(
    responseEvent: WebSocketResponseEvents,
    handler: HandlerWithCanvasId<TPayload>
): StandardHandler<TPayload> {
    return async (socket: Socket, payload: TPayload, requestId: string): Promise<void> => {
        const canvasId = getCanvasId(socket, responseEvent, requestId);
        if (!canvasId) {
            return;
        }

        await handler(socket, canvasId, payload, requestId);
    };
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
        emitError(socket, responseEvent, `Pod 找不到: ${podId}`, requestId, podId, 'NOT_FOUND');
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
    idFieldName?: string;
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
            `${resourceName} 找不到: ${resourceId}`,
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

    socketService.emitToAll(responseEvent, response);

    logger.log(resourceName, 'Delete', `Deleted ${resourceName.toLowerCase()} ${resourceId} and ${deletedNoteIds.length} notes`);
}
