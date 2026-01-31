import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type SubAgentListResultPayload,
    type PodSubAgentBoundPayload,
} from '../types/index.js';
import type {
    SubAgentListPayload,
    PodBindSubAgentPayload,
    SubAgentDeletePayload,
} from '../schemas/index.js';
import {subAgentService} from '../services/subAgentService.js';
import {subAgentNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {repositoryService} from '../services/repositoryService.js';
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createResourceHandlers} from './factories/createResourceHandlers.js';
import {validatePod, handleResourceDelete} from '../utils/handlerHelpers.js';

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
    socket: Socket,
    _: SubAgentListPayload,
    requestId: string
): Promise<void> {
    const subAgents = await subAgentService.listSubAgents();

    const response: SubAgentListResultPayload = {
        requestId,
        success: true,
        subAgents,
    };

    emitSuccess(socket, WebSocketResponseEvents.SUBAGENT_LIST_RESULT, response);
}

export async function handlePodBindSubAgent(
    socket: Socket,
    payload: PodBindSubAgentPayload,
    requestId: string
): Promise<void> {
    const {podId, subAgentId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_SUBAGENT_BOUND, requestId);

    if (!pod) {
        return;
    }

    const subAgentExists = await subAgentService.exists(subAgentId);
    if (!subAgentExists) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_SUBAGENT_BOUND,
            `SubAgent not found: ${subAgentId}`,
            requestId,
            podId,
            'NOT_FOUND'
        );
        return;
    }

    if (pod.subAgentIds.includes(subAgentId)) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_SUBAGENT_BOUND,
            `SubAgent ${subAgentId} is already bound to Pod ${podId}`,
            requestId,
            podId,
            'CONFLICT'
        );
        return;
    }

    if (pod.repositoryId) {
        const repositoryPath = repositoryService.getRepositoryPath(pod.repositoryId);
        await subAgentService.copySubAgentToRepository(subAgentId, repositoryPath);
    } else {
        await subAgentService.copySubAgentToPod(subAgentId, podId);
    }

    podStore.addSubAgentId(podId, subAgentId);
    const updatedPod = podStore.getById(podId);

    const response: PodSubAgentBoundPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_SUBAGENT_BOUND, response);

    logger.log('SubAgent', 'Bind', `Bound subagent ${subAgentId} to Pod ${podId}`);
}

export async function handleSubAgentDelete(
    socket: Socket,
    payload: SubAgentDeletePayload,
    requestId: string
): Promise<void> {
    const {subAgentId} = payload;

    await handleResourceDelete({
        socket,
        requestId,
        resourceId: subAgentId,
        resourceName: 'SubAgent',
        responseEvent: WebSocketResponseEvents.SUBAGENT_DELETED,
        existsCheck: () => subAgentService.exists(subAgentId),
        findPodsUsing: () => podStore.findBySubAgentId(subAgentId),
        deleteNotes: () => subAgentNoteStore.deleteByForeignKey(subAgentId),
        deleteResource: () => subAgentService.delete(subAgentId),
    });
}
