import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type PodCreatedPayload,
    type PodListResultPayload,
    type PodGetResultPayload,
    type PodUpdatedPayload,
    type PodDeletedPayload,
} from '../types/index.js';
import type {
    PodCreatePayload,
    PodListPayload,
    PodGetPayload,
    PodUpdatePayload,
    PodDeletePayload,
} from '../schemas/index.js';
import {podStore} from '../services/podStore.js';
import {workspaceService} from '../services/workspace/index.js';
import {claudeSessionManager} from '../services/claude/sessionManager.js';
import {noteStore, skillNoteStore, repositoryNoteStore, commandNoteStore, subAgentNoteStore} from '../services/noteStores.js';
import {connectionStore} from '../services/connectionStore.js';
import {socketService} from '../services/socketService.js';
import { workflowStateService } from '../services/workflow/index.js';
import {repositorySyncService} from '../services/repositorySyncService.js';
import {canvasStore} from '../services/canvasStore.js';
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {validatePod} from '../utils/handlerHelpers.js';

export async function handlePodCreate(
    socket: Socket,
    payload: PodCreatePayload,
    requestId: string
): Promise<void> {
    const {name, color, x, y, rotation} = payload;
    const canvasId = canvasStore.getActiveCanvas(socket.id);

    if (!canvasId) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_CREATED,
            'No active canvas',
            requestId,
            undefined,
            'INTERNAL_ERROR'
        );
        return;
    }

    const pod = podStore.create(canvasId, {name, color, x, y, rotation});

    const workspaceResult = await workspaceService.createWorkspace(pod.id);
    if (!workspaceResult.success) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_CREATED,
            `建立工作區失敗 (Pod ${pod.id})`,
            requestId,
            pod.id,
            'INTERNAL_ERROR'
        );
        return;
    }

    await claudeSessionManager.createSession(pod.id, pod.workspacePath);

    const response: PodCreatedPayload = {
        requestId,
        success: true,
        pod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_CREATED, response);

    logger.log('Pod', 'Create', `Created Pod ${pod.id} (${pod.name})`);
}

export async function handlePodList(
    socket: Socket,
    _: PodListPayload,
    requestId: string
): Promise<void> {
    const canvasId = canvasStore.getActiveCanvas(socket.id);

    if (!canvasId) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_LIST_RESULT,
            'No active canvas',
            requestId,
            undefined,
            'INTERNAL_ERROR'
        );
        return;
    }

    const pods = podStore.getAll(canvasId);

    const response: PodListResultPayload = {
        requestId,
        success: true,
        pods,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_LIST_RESULT, response);
}

export async function handlePodGet(
    socket: Socket,
    payload: PodGetPayload,
    requestId: string
): Promise<void> {
    const {podId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_GET_RESULT, requestId);

    if (!pod) {
        return;
    }

    const response: PodGetResultPayload = {
        requestId,
        success: true,
        pod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_GET_RESULT, response);
}

export async function handlePodDelete(
    socket: Socket,
    payload: PodDeletePayload,
    requestId: string
): Promise<void> {
    const {podId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_DELETED, requestId);

    if (!pod) {
        return;
    }

    const canvasId = canvasStore.getActiveCanvas(socket.id);
    if (!canvasId) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_DELETED,
            'No active canvas',
            requestId,
            podId,
            'INTERNAL_ERROR'
        );
        return;
    }

    workflowStateService.handleSourceDeletion(canvasId, podId);

    await claudeSessionManager.destroySession(podId);

    const deleteResult = await workspaceService.deleteWorkspace(podId);
    if (!deleteResult.success) {
        logger.error('Pod', 'Delete', `Failed to delete workspace for Pod ${podId}`, deleteResult.error);
    }

    noteStore.deleteByBoundPodId(canvasId, podId);
    skillNoteStore.deleteByBoundPodId(canvasId, podId);
    repositoryNoteStore.deleteByBoundPodId(canvasId, podId);
    commandNoteStore.deleteByBoundPodId(canvasId, podId);
    subAgentNoteStore.deleteByBoundPodId(canvasId, podId);
    connectionStore.deleteByPodId(canvasId, podId);

    const repositoryId = pod.repositoryId;

    const deleted = podStore.delete(canvasId, podId);

    if (repositoryId) {
        try {
            await repositorySyncService.syncRepositoryResources(repositoryId);
        } catch (error) {
            logger.error('Pod', 'Delete', `Failed to sync repository ${repositoryId} after pod deletion`, error);
        }
    }

    if (!deleted) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_DELETED,
            `Failed to delete Pod from store: ${podId}`,
            requestId,
            podId,
            'INTERNAL_ERROR'
        );
        return;
    }

    const response: PodDeletedPayload = {
        requestId,
        success: true,
        podId,
    };

    socketService.emitPodDeletedBroadcast(podId, response);

    emitSuccess(socket, WebSocketResponseEvents.POD_DELETED, response);

    logger.log('Pod', 'Delete', `Deleted Pod ${podId}`);
}

/**
 * Handle Pod update request (position, name, etc.)
 */
export async function handlePodUpdate(
    socket: Socket,
    payload: PodUpdatePayload,
    requestId: string
): Promise<void> {
    const {podId, x, y, rotation, name, model} = payload;

    const existingPod = validatePod(socket, podId, WebSocketResponseEvents.POD_UPDATED, requestId);

    if (!existingPod) {
        return;
    }

    const canvasId = canvasStore.getActiveCanvas(socket.id);
    if (!canvasId) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_UPDATED,
            'No active canvas',
            requestId,
            podId,
            'INTERNAL_ERROR'
        );
        return;
    }

    const updates: Record<string, unknown> = {};

    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (rotation !== undefined) updates.rotation = rotation;
    if (name !== undefined) updates.name = name;
    if (model !== undefined) {
        updates.model = model;
        // 保留 session，讓 SDK 嘗試用新 model 繼續對話
    }

    const updatedPod = podStore.update(canvasId, podId, updates);

    if (!updatedPod) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_UPDATED,
            `Failed to update Pod: ${podId}`,
            requestId,
            podId,
            'INTERNAL_ERROR'
        );
        return;
    }

    const response: PodUpdatedPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_UPDATED, response);
}
