import {existsSync} from 'fs';
import {WebSocketResponseEvents} from '../schemas';
import type {
    PodCreatedPayload,
    PodListResultPayload,
    PodGetResultPayload,
    PodScheduleSetPayload,
    PodDeletedPayload,
    PodDirectoryOpenedPayload,
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
    PodOpenDirectoryPayload,
} from '../schemas';
import type {Pod} from '../types';
import {podStore} from '../services/podStore.js';
import {workspaceService} from '../services/workspace';
import {noteStore, skillNoteStore, repositoryNoteStore, commandNoteStore, subAgentNoteStore, mcpServerNoteStore} from '../services/noteStores.js';
import {connectionStore} from '../services/connectionStore.js';
import {socketService} from '../services/socketService.js';
import {workflowStateService} from '../services/workflow';
import {repositorySyncService} from '../services/repositorySyncService.js';
import {repositoryService} from '../services/repositoryService.js';
import {podManifestService} from '../services/podManifestService.js';
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
    const noteStoreConfigs: Array<{store: {deleteByBoundPodId: (canvasId: string, podId: string) => string[]}; key: keyof NonNullable<PodDeletedPayload['deletedNoteIds']>}> = [
        {store: noteStore, key: 'note'},
        {store: skillNoteStore, key: 'skillNote'},
        {store: repositoryNoteStore, key: 'repositoryNote'},
        {store: commandNoteStore, key: 'commandNote'},
        {store: subAgentNoteStore, key: 'subAgentNote'},
        {store: mcpServerNoteStore, key: 'mcpServerNote'},
    ];

    const result: PodDeletedPayload['deletedNoteIds'] = {};

    for (const {store, key} of noteStoreConfigs) {
        const ids = store.deleteByBoundPodId(canvasId, podId);
        if (ids.length > 0) {
            result[key] = ids;
        }
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

        const deleteResult = await workspaceService.deleteWorkspace(pod.workspacePath);
        if (!deleteResult.success) {
            logger.error('Pod', 'Delete', `無法刪除 Pod ${podId} 的工作區`, deleteResult.error);
        }

        const deletedNoteIdsPayload = deleteAllPodNotes(canvasId, podId);
        connectionStore.deleteByPodId(canvasId, podId);

        const repositoryId = pod.repositoryId;

        if (repositoryId) {
            const repositoryPath = repositoryService.getRepositoryPath(repositoryId);
            await podManifestService.deleteManagedFiles(repositoryPath, podId);
        }

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

function buildScheduleUpdates(
    schedule: NonNullable<PodSetSchedulePayload['schedule']> | null,
    existingSchedule: Pod['schedule']
): Record<string, unknown> {
    if (schedule === null) {
        return {schedule: null};
    }

    const isEnabling = schedule.enabled && (!existingSchedule || !existingSchedule.enabled);
    const lastTriggeredAt = isEnabling ? new Date() : (existingSchedule?.lastTriggeredAt ?? null);

    return {
        schedule: {
            ...schedule,
            lastTriggeredAt,
        },
    };
}

export const handlePodSetSchedule = withCanvasId<PodSetSchedulePayload>(
    WebSocketResponseEvents.POD_SCHEDULE_SET,
    async (connectionId: string, canvasId: string, payload: PodSetSchedulePayload, requestId: string): Promise<void> => {
        const {podId, schedule} = payload;

        const existingPod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_SCHEDULE_SET, requestId);
        if (!existingPod) {
            return;
        }

        const updates = buildScheduleUpdates(schedule, existingPod.schedule);
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

const PLATFORM_COMMANDS: Record<string, string> = {
    darwin: 'open',
    linux: 'xdg-open',
    win32: 'explorer',
};

function getOpenCommand(platform: string): string | null {
    return PLATFORM_COMMANDS[platform] ?? null;
}

export const handlePodOpenDirectory = withCanvasId<PodOpenDirectoryPayload>(
    WebSocketResponseEvents.POD_DIRECTORY_OPENED,
    async (connectionId: string, canvasId: string, payload: PodOpenDirectoryPayload, requestId: string): Promise<void> => {
        const {podId} = payload;

        const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_DIRECTORY_OPENED, requestId);
        if (!pod) {
            return;
        }

        const targetPath = pod.repositoryId
            ? repositoryService.getRepositoryPath(pod.repositoryId)
            : pod.workspacePath;

        if (!existsSync(targetPath)) {
            emitError(
                connectionId,
                WebSocketResponseEvents.POD_DIRECTORY_OPENED,
                '目標目錄不存在',
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const command = getOpenCommand(process.platform);
        if (!command) {
            emitError(
                connectionId,
                WebSocketResponseEvents.POD_DIRECTORY_OPENED,
                `不支援的作業系統: ${process.platform}`,
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const proc = Bun.spawn([command, targetPath]);
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
            emitError(
                connectionId,
                WebSocketResponseEvents.POD_DIRECTORY_OPENED,
                '打開目錄失敗',
                requestId,
                podId,
                'INTERNAL_ERROR'
            );
            return;
        }

        const response: PodDirectoryOpenedPayload = {
            requestId,
            success: true,
            path: targetPath,
        };

        emitSuccess(connectionId, WebSocketResponseEvents.POD_DIRECTORY_OPENED, response);

        logger.log('Pod', 'Load', `已打開目錄: ${targetPath}`);
    }
);
