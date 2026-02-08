import {WebSocketResponseEvents} from '../schemas';
import type {
    PodCreatedPayload,
    PodListResultPayload,
    PodGetResultPayload,
    PodScheduleSetPayload,
    PodDeletedPayload,
} from '../types';
import type {
    PodCreatePayload,
    PodListPayload,
    PodGetPayload,
    PodMovePayload,
    PodRenamePayload,
    PodSetModelPayload,
    PodSetSchedulePayload,
    PodDeletePayload,
} from '../schemas';
import type {Pod} from '../types';
import {podStore} from '../services/podStore.js';
import {workspaceService} from '../services/workspace';
import {claudeSessionManager} from '../services/claude/sessionManager.js';
import {noteStore, skillNoteStore, repositoryNoteStore, commandNoteStore, subAgentNoteStore} from '../services/noteStores.js';
import {connectionStore} from '../services/connectionStore.js';
import {socketService} from '../services/socketService.js';
import {workflowStateService} from '../services/workflow';
import {repositorySyncService} from '../services/repositorySyncService.js';
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {validatePod, withCanvasId} from '../utils/handlerHelpers.js';

export const handlePodCreate = withCanvasId<PodCreatePayload>(
    WebSocketResponseEvents.POD_CREATED,
    async (connectionId: string, canvasId: string, payload: PodCreatePayload, requestId: string): Promise<void> => {
        const {name, color, x, y, rotation} = payload;

        const pod = podStore.create(canvasId, {name, color, x, y, rotation});

    const workspaceResult = await workspaceService.createWorkspace(pod.workspacePath);
    if (!workspaceResult.success) {
        emitError(
            connectionId,
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
        canvasId,
        success: true,
        pod,
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_CREATED, response);

    logger.log('Pod', 'Create', `Created Pod ${pod.id} (${pod.name})`);
    }
);

export const handlePodList = withCanvasId<PodListPayload>(
    WebSocketResponseEvents.POD_LIST_RESULT,
    async (connectionId: string, canvasId: string, _: PodListPayload, requestId: string): Promise<void> => {

    const pods = podStore.getAll(canvasId);

        const response: PodListResultPayload = {
            requestId,
            success: true,
            pods,
        };

        emitSuccess(connectionId, WebSocketResponseEvents.POD_LIST_RESULT, response);
    }
);

export async function handlePodGet(
    connectionId: string,
    payload: PodGetPayload,
    requestId: string
): Promise<void> {
    const {podId} = payload;

    const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_GET_RESULT, requestId);

    if (!pod) {
        return;
    }

    const response: PodGetResultPayload = {
        requestId,
        success: true,
        pod,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.POD_GET_RESULT, response);
}

function deleteAllPodNotes(canvasId: string, podId: string): PodDeletedPayload['deletedNoteIds'] {
    const deletedNoteIds = noteStore.deleteByBoundPodId(canvasId, podId);
    const deletedSkillNoteIds = skillNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedRepositoryNoteIds = repositoryNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedCommandNoteIds = commandNoteStore.deleteByBoundPodId(canvasId, podId);
    const deletedSubAgentNoteIds = subAgentNoteStore.deleteByBoundPodId(canvasId, podId);

    const result: PodDeletedPayload['deletedNoteIds'] = {};

    if (deletedNoteIds.length > 0) {
        result.note = deletedNoteIds;
    }
    if (deletedSkillNoteIds.length > 0) {
        result.skillNote = deletedSkillNoteIds;
    }
    if (deletedRepositoryNoteIds.length > 0) {
        result.repositoryNote = deletedRepositoryNoteIds;
    }
    if (deletedCommandNoteIds.length > 0) {
        result.commandNote = deletedCommandNoteIds;
    }
    if (deletedSubAgentNoteIds.length > 0) {
        result.subAgentNote = deletedSubAgentNoteIds;
    }

    return result;
}

export const handlePodDelete = withCanvasId<PodDeletePayload>(
    WebSocketResponseEvents.POD_DELETED,
    async (connectionId: string, canvasId: string, payload: PodDeletePayload, requestId: string): Promise<void> => {
        const {podId} = payload;

        const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_DELETED, requestId);
        if (!pod) {
            return;
        }

        workflowStateService.handleSourceDeletion(canvasId, podId);

        await claudeSessionManager.destroySession(podId);

        const deleteResult = await workspaceService.deleteWorkspace(pod.workspacePath);
        if (!deleteResult.success) {
            logger.error('Pod', 'Delete', `無法刪除 Pod ${podId} 的工作區`, deleteResult.error);
        }

        const deletedNoteIdsPayload = deleteAllPodNotes(canvasId, podId);
        connectionStore.deleteByPodId(canvasId, podId);

        const repositoryId = pod.repositoryId;

        const deleted = podStore.delete(canvasId, podId);
        if (!deleted) {
            emitError(
                connectionId,
                WebSocketResponseEvents.POD_DELETED,
                `無法從 store 刪除 Pod: ${podId}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        if (repositoryId) {
            try {
                await repositorySyncService.syncRepositoryResources(repositoryId);
            } catch (error) {
                logger.error('Pod', 'Delete', `刪除 Pod 後無法同步 repository ${repositoryId}`, error);
            }
        }

        const response: PodDeletedPayload = {
            requestId,
            canvasId,
            success: true,
            podId,
            ...(deletedNoteIdsPayload && Object.keys(deletedNoteIdsPayload).length > 0 && {deletedNoteIds: deletedNoteIdsPayload}),
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_DELETED, response);

        logger.log('Pod', 'Delete', `Deleted Pod ${podId}`);
    }
);

function handlePodUpdate<TResponse>(
    connectionId: string,
    canvasId: string,
    podId: string,
    updates: Partial<Omit<Pod, 'id'>>,
    requestId: string,
    responseEvent: WebSocketResponseEvents,
    createResponse: (pod: Pod) => TResponse
): void {
    const existingPod = validatePod(connectionId, podId, responseEvent, requestId);
    if (!existingPod) {
        return;
    }

    const updatedPod = podStore.update(canvasId, podId, updates);
    if (!updatedPod) {
        emitError(connectionId, responseEvent, `無法更新 Pod: ${podId}`, requestId, podId, 'INTERNAL_ERROR');
        return;
    }

    const response = createResponse(updatedPod);
    socketService.emitToCanvas(canvasId, responseEvent, response);
}

export const handlePodMove = withCanvasId<PodMovePayload>(
    WebSocketResponseEvents.POD_MOVED,
    async (connectionId: string, canvasId: string, payload: PodMovePayload, requestId: string): Promise<void> => {
        const {podId, x, y} = payload;

        handlePodUpdate(
            connectionId,
            canvasId,
            podId,
            {x, y},
            requestId,
            WebSocketResponseEvents.POD_MOVED,
            (pod) => ({requestId, canvasId, success: true, pod})
        );
    }
);

export const handlePodRename = withCanvasId<PodRenamePayload>(
    WebSocketResponseEvents.POD_RENAMED,
    async (connectionId: string, canvasId: string, payload: PodRenamePayload, requestId: string): Promise<void> => {
        const {podId, name} = payload;

        handlePodUpdate(
            connectionId,
            canvasId,
            podId,
            {name},
            requestId,
            WebSocketResponseEvents.POD_RENAMED,
            (pod) => {
                logger.log('Pod', 'Rename', `Renamed Pod ${pod.id} to ${pod.name}`);
                return {requestId, canvasId, success: true, pod, podId: pod.id, name: pod.name};
            }
        );
    }
);

export const handlePodSetModel = withCanvasId<PodSetModelPayload>(
    WebSocketResponseEvents.POD_MODEL_SET,
    async (connectionId: string, canvasId: string, payload: PodSetModelPayload, requestId: string): Promise<void> => {
        const {podId, model} = payload;

        handlePodUpdate(
            connectionId,
            canvasId,
            podId,
            {model},
            requestId,
            WebSocketResponseEvents.POD_MODEL_SET,
            (pod) => ({requestId, canvasId, success: true, pod})
        );
    }
);

export const handlePodSetSchedule = withCanvasId<PodSetSchedulePayload>(
    WebSocketResponseEvents.POD_SCHEDULE_SET,
    async (connectionId: string, canvasId: string, payload: PodSetSchedulePayload, requestId: string): Promise<void> => {
        const {podId, schedule} = payload;

        const existingPod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_SCHEDULE_SET, requestId);

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
                connectionId,
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
            canvasId,
            success: true,
            pod: updatedPod,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_SCHEDULE_SET, response);
    }
);
