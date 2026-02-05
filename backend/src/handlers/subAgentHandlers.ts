import {WebSocketResponseEvents} from '../schemas';
import type {
    SubAgentListResultPayload,
    PodSubAgentBoundPayload,
} from '../types';
import type {
    SubAgentListPayload,
    PodBindSubAgentPayload,
    SubAgentDeletePayload,
    SubAgentMoveToGroupPayload,
} from '../schemas';
import {subAgentService} from '../services/subAgentService.js';
import {subAgentNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {socketService} from '../services/socketService.js';
import {repositoryService} from '../services/repositoryService.js';
import {repositorySyncService} from '../services/repositorySyncService.js';
import {emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createResourceHandlers} from './factories/createResourceHandlers.js';
import {validatePod, handleResourceDelete, withCanvasId} from '../utils/handlerHelpers.js';
import {createMoveToGroupHandler} from './factories/createMoveToGroupHandler.js';
import {GROUP_TYPES} from '../types';

const subAgentNoteHandlers = createNoteHandlers({
    noteStore: subAgentNoteStore,
    events: {
        created: WebSocketResponseEvents.SUBAGENT_NOTE_CREATED,
        listResult: WebSocketResponseEvents.SUBAGENT_NOTE_LIST_RESULT,
        updated: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.SUBAGENT_NOTE_DELETED,
    },
    foreignKeyField: 'subAgentId',
    entityName: 'SubAgent',
});

export const handleSubAgentNoteCreate = subAgentNoteHandlers.handleNoteCreate;
export const handleSubAgentNoteList = subAgentNoteHandlers.handleNoteList;
export const handleSubAgentNoteUpdate = subAgentNoteHandlers.handleNoteUpdate;
export const handleSubAgentNoteDelete = subAgentNoteHandlers.handleNoteDelete;

const resourceHandlers = createResourceHandlers({
    service: subAgentService,
    events: {
        listResult: WebSocketResponseEvents.SUBAGENT_LIST_RESULT,
        created: WebSocketResponseEvents.SUBAGENT_CREATED,
        updated: WebSocketResponseEvents.SUBAGENT_UPDATED,
        readResult: WebSocketResponseEvents.SUBAGENT_READ_RESULT,
    },
    resourceName: 'SubAgent',
    responseKey: 'subAgent',
    idField: 'subAgentId',
});

export const handleSubAgentCreate = resourceHandlers.handleCreate;
export const handleSubAgentUpdate = resourceHandlers.handleUpdate;
export const handleSubAgentRead = resourceHandlers.handleRead!;

export async function handleSubAgentList(
    connectionId: string,
    _: SubAgentListPayload,
    requestId: string
): Promise<void> {
    const subAgents = await subAgentService.list();

    const response: SubAgentListResultPayload = {
        requestId,
        success: true,
        subAgents,
    };

    socketService.emitToConnection(connectionId, WebSocketResponseEvents.SUBAGENT_LIST_RESULT, response);
}

export const handlePodBindSubAgent = withCanvasId<PodBindSubAgentPayload>(
    WebSocketResponseEvents.POD_SUBAGENT_BOUND,
    async (connectionId: string, canvasId: string, payload: PodBindSubAgentPayload, requestId: string): Promise<void> => {
        const {podId, subAgentId} = payload;

        const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_SUBAGENT_BOUND, requestId);

        if (!pod) {
            return;
        }

    const subAgentExists = await subAgentService.exists(subAgentId);
    if (!subAgentExists) {
        emitError(
            connectionId,
            WebSocketResponseEvents.POD_SUBAGENT_BOUND,
            `SubAgent 找不到: ${subAgentId}`,
            requestId,
            podId,
            'NOT_FOUND'
        );
        return;
    }

    if (pod.subAgentIds.includes(subAgentId)) {
        emitError(
            connectionId,
            WebSocketResponseEvents.POD_SUBAGENT_BOUND,
            `SubAgent ${subAgentId} 已綁定到 Pod ${podId}`,
            requestId,
            podId,
            'CONFLICT'
        );
        return;
    }

    if (!pod.repositoryId) {
        await subAgentService.copySubAgentToPod(subAgentId, podId, pod.workspacePath);
    } else {
        const repositoryPath = repositoryService.getRepositoryPath(pod.repositoryId);
        await subAgentService.copySubAgentToRepository(subAgentId, repositoryPath);
    }

    podStore.addSubAgentId(canvasId, podId, subAgentId);

    if (pod.repositoryId) {
        await repositorySyncService.syncRepositoryResources(pod.repositoryId);
    }

    const updatedPod = podStore.getById(canvasId, podId);

    const response: PodSubAgentBoundPayload = {
        requestId,
        canvasId,
        success: true,
        pod: updatedPod,
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_SUBAGENT_BOUND, response);

    logger.log('SubAgent', 'Bind', `Bound subagent ${subAgentId} to Pod ${podId}`);
    }
);

export async function handleSubAgentDelete(
    connectionId: string,
    payload: SubAgentDeletePayload,
    requestId: string
): Promise<void> {
    const {subAgentId} = payload;

    await handleResourceDelete({
        connectionId,
        requestId,
        resourceId: subAgentId,
        resourceName: 'SubAgent',
        responseEvent: WebSocketResponseEvents.SUBAGENT_DELETED,
        existsCheck: () => subAgentService.exists(subAgentId),
        findPodsUsing: (canvasId: string) => podStore.findBySubAgentId(canvasId, subAgentId),
        deleteNotes: (canvasId: string) => subAgentNoteStore.deleteByForeignKey(canvasId, subAgentId),
        deleteResource: () => subAgentService.delete(subAgentId),
    });
}

const subAgentMoveToGroupHandler = createMoveToGroupHandler({
    service: subAgentService,
    resourceName: 'SubAgent',
    idField: 'itemId',
    groupType: GROUP_TYPES.SUBAGENT,
    events: {
        moved: WebSocketResponseEvents.SUBAGENT_MOVED_TO_GROUP,
    },
});

export async function handleSubAgentMoveToGroup(
    connectionId: string,
    payload: SubAgentMoveToGroupPayload,
    requestId: string
): Promise<void> {
    return subAgentMoveToGroupHandler(connectionId, payload, requestId);
}
