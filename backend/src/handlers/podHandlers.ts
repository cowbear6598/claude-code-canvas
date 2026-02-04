import type {Socket} from 'socket.io';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {
    PodCreatedPayload,
    PodListResultPayload,
    PodGetResultPayload,
    PodMovedPayload,
    PodRenamedPayload,
    PodModelSetPayload,
    PodScheduleSetPayload,
    PodDeletedPayload,
    BroadcastPodCreatedPayload,
    BroadcastPodMovedPayload,
    BroadcastPodRenamedPayload,
    BroadcastPodModelSetPayload,
    BroadcastPodScheduleSetPayload,
    BroadcastPodDeletedPayload,
} from '../types/index.js';
import type {
    PodCreatePayload,
    PodListPayload,
    PodGetPayload,
    PodMovePayload,
    PodRenamePayload,
    PodSetModelPayload,
    PodSetSchedulePayload,
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
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {validatePod, withCanvasId} from '../utils/handlerHelpers.js';

export const handlePodCreate = withCanvasId<PodCreatePayload>(
    WebSocketResponseEvents.POD_CREATED,
    async (socket: Socket, canvasId: string, payload: PodCreatePayload, requestId: string): Promise<void> => {
        const {name, color, x, y, rotation} = payload;

    const pod = podStore.create(canvasId, {name, color, x, y, rotation});

    const workspaceResult = await workspaceService.createWorkspace(pod.workspacePath);
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

    const broadcastPayload: BroadcastPodCreatedPayload = {
        canvasId,
        pod,
    };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_CREATED, broadcastPayload);

        logger.log('Pod', 'Create', `Created Pod ${pod.id} (${pod.name})`);
    }
);

export const handlePodList = withCanvasId<PodListPayload>(
    WebSocketResponseEvents.POD_LIST_RESULT,
    async (socket: Socket, canvasId: string, _: PodListPayload, requestId: string): Promise<void> => {

    const pods = podStore.getAll(canvasId);

        const response: PodListResultPayload = {
            requestId,
            success: true,
            pods,
        };

        emitSuccess(socket, WebSocketResponseEvents.POD_LIST_RESULT, response);
    }
);

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

export const handlePodDelete = withCanvasId<PodDeletePayload>(
    WebSocketResponseEvents.POD_DELETED,
    async (socket: Socket, canvasId: string, payload: PodDeletePayload, requestId: string): Promise<void> => {
        const {podId} = payload;

        const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_DELETED, requestId);

        if (!pod) {
            return;
        }

    workflowStateService.handleSourceDeletion(canvasId, podId);

    await claudeSessionManager.destroySession(podId);

    const deleteResult = await workspaceService.deleteWorkspace(pod.workspacePath);
    if (!deleteResult.success) {
        logger.error('Pod', 'Delete', `Failed to delete workspace for Pod ${podId}`, deleteResult.error);
    }

    const deletedNoteIds = noteStore.deleteByBoundPodId(canvasId, podId);
    const deletedSkillNoteIds = skillNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedRepositoryNoteIds = repositoryNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedCommandNoteIds = commandNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedSubAgentNoteIds = subAgentNoteStore.deleteByBoundPodId(canvasId, podId);
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

    const deletedNoteIdsPayload: BroadcastPodDeletedPayload['deletedNoteIds'] = {};
    if (deletedNoteIds.length > 0) {
        deletedNoteIdsPayload.note = deletedNoteIds;
    }
    if (deletedSkillNoteIds.length > 0) {
        deletedNoteIdsPayload.skillNote = deletedSkillNoteIds;
    }
    if (deletedRepositoryNoteIds.length > 0) {
        deletedNoteIdsPayload.repositoryNote = deletedRepositoryNoteIds;
    }
    if (deletedCommandNoteIds.length > 0) {
        deletedNoteIdsPayload.commandNote = deletedCommandNoteIds;
    }
    if (deletedSubAgentNoteIds.length > 0) {
        deletedNoteIdsPayload.subAgentNote = deletedSubAgentNoteIds;
    }

    const response: PodDeletedPayload = {
        requestId,
        success: true,
        podId,
        ...(Object.keys(deletedNoteIdsPayload).length > 0 && { deletedNoteIds: deletedNoteIdsPayload }),
    };

    socketService.emitPodDeletedBroadcast(podId, response);

    emitSuccess(socket, WebSocketResponseEvents.POD_DELETED, response);

    const broadcastPayload: BroadcastPodDeletedPayload = {
        canvasId,
        podId,
        ...(Object.keys(deletedNoteIdsPayload).length > 0 && { deletedNoteIds: deletedNoteIdsPayload }),
    };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_DELETED, broadcastPayload);

        logger.log('Pod', 'Delete', `Deleted Pod ${podId}`);
    }
);

export const handlePodMove = withCanvasId<PodMovePayload>(
    WebSocketResponseEvents.POD_MOVED,
    async (socket: Socket, canvasId: string, payload: PodMovePayload, requestId: string): Promise<void> => {
        const {podId, x, y} = payload;

        const existingPod = validatePod(socket, podId, WebSocketResponseEvents.POD_MOVED, requestId);

        if (!existingPod) {
            return;
        }

        const updatedPod = podStore.update(canvasId, podId, {x, y});

        if (!updatedPod) {
            emitError(
                socket,
                WebSocketResponseEvents.POD_MOVED,
                `無法更新 Pod: ${podId}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const response: PodMovedPayload = {
            requestId,
            success: true,
            pod: updatedPod,
        };

        emitSuccess(socket, WebSocketResponseEvents.POD_MOVED, response);

        const broadcastPayload: BroadcastPodMovedPayload = {
            canvasId,
            podId,
            x: updatedPod.x,
            y: updatedPod.y,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_MOVED, broadcastPayload);
    }
);

export const handlePodRename = withCanvasId<PodRenamePayload>(
    WebSocketResponseEvents.POD_RENAMED,
    async (socket: Socket, canvasId: string, payload: PodRenamePayload, requestId: string): Promise<void> => {
        const {podId, name} = payload;

        const existingPod = validatePod(socket, podId, WebSocketResponseEvents.POD_RENAMED, requestId);

        if (!existingPod) {
            return;
        }

        const updatedPod = podStore.update(canvasId, podId, {name});

        if (!updatedPod) {
            emitError(
                socket,
                WebSocketResponseEvents.POD_RENAMED,
                `無法更新 Pod: ${podId}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const response: PodRenamedPayload = {
            requestId,
            success: true,
            pod: updatedPod,
        };

        emitSuccess(socket, WebSocketResponseEvents.POD_RENAMED, response);

        const broadcastPayload: BroadcastPodRenamedPayload = {
            canvasId,
            podId,
            name: updatedPod.name,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_RENAMED, broadcastPayload);
    }
);

export const handlePodSetModel = withCanvasId<PodSetModelPayload>(
    WebSocketResponseEvents.POD_MODEL_SET,
    async (socket: Socket, canvasId: string, payload: PodSetModelPayload, requestId: string): Promise<void> => {
        const {podId, model} = payload;

        const existingPod = validatePod(socket, podId, WebSocketResponseEvents.POD_MODEL_SET, requestId);

        if (!existingPod) {
            return;
        }

        const updatedPod = podStore.update(canvasId, podId, {model});

        if (!updatedPod) {
            emitError(
                socket,
                WebSocketResponseEvents.POD_MODEL_SET,
                `無法更新 Pod: ${podId}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const response: PodModelSetPayload = {
            requestId,
            success: true,
            pod: updatedPod,
        };

        emitSuccess(socket, WebSocketResponseEvents.POD_MODEL_SET, response);

        const broadcastPayload: BroadcastPodModelSetPayload = {
            canvasId,
            podId,
            model: updatedPod.model,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_MODEL_SET, broadcastPayload);
    }
);

export const handlePodSetSchedule = withCanvasId<PodSetSchedulePayload>(
    WebSocketResponseEvents.POD_SCHEDULE_SET,
    async (socket: Socket, canvasId: string, payload: PodSetSchedulePayload, requestId: string): Promise<void> => {
        const {podId, schedule} = payload;

        const existingPod = validatePod(socket, podId, WebSocketResponseEvents.POD_SCHEDULE_SET, requestId);

        if (!existingPod) {
            return;
        }

        const updates: Record<string, unknown> = {};

        if (schedule === null) {
            updates.schedule = null;
        } else {
            const existingSchedule = existingPod.schedule;
            const isEnabling = schedule.enabled && (!existingSchedule || !existingSchedule.enabled);

            let lastTriggeredAt: Date | null;
            if (isEnabling) {
                lastTriggeredAt = new Date();
            } else {
                lastTriggeredAt = existingSchedule?.lastTriggeredAt ?? null;
            }

            updates.schedule = {
                ...schedule,
                lastTriggeredAt,
            };
        }

        const updatedPod = podStore.update(canvasId, podId, updates);

        if (!updatedPod) {
            emitError(
                socket,
                WebSocketResponseEvents.POD_SCHEDULE_SET,
                `無法更新 Pod: ${podId}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const response: PodScheduleSetPayload = {
            requestId,
            success: true,
            pod: updatedPod,
        };

        emitSuccess(socket, WebSocketResponseEvents.POD_SCHEDULE_SET, response);

        const broadcastPayload: BroadcastPodScheduleSetPayload = {
            canvasId,
            podId,
            schedule: updatedPod.schedule ?? null,
        };
        socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_SCHEDULE_SET, broadcastPayload);
    }
);
