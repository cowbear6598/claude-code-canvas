import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type SkillListResultPayload,
    type PodSkillBoundPayload,
} from '../types/index.js';
import type {
    SkillListPayload,
    PodBindSkillPayload,
    SkillDeletePayload,
} from '../schemas/index.js';
import {skillService} from '../services/skillService.js';
import {skillNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {repositorySyncService} from '../services/repositorySyncService.js';
import {emitSuccess, emitError} from '../utils/websocketResponse.js';
import {logger} from '../utils/logger.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {validatePod, handleResourceDelete} from '../utils/handlerHelpers.js';

const skillNoteHandlers = createNoteHandlers({
    noteStore: skillNoteStore,
    events: {
        created: WebSocketResponseEvents.SKILL_NOTE_CREATED,
        listResult: WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT,
        updated: WebSocketResponseEvents.SKILL_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.SKILL_NOTE_DELETED,
    },
    foreignKeyField: 'skillId',
    entityName: 'Skill',
});

export const handleSkillNoteCreate = skillNoteHandlers.handleNoteCreate;
export const handleSkillNoteList = skillNoteHandlers.handleNoteList;
export const handleSkillNoteUpdate = skillNoteHandlers.handleNoteUpdate;
export const handleSkillNoteDelete = skillNoteHandlers.handleNoteDelete;

export async function handleSkillList(
    socket: Socket,
    _: SkillListPayload,
    requestId: string
): Promise<void> {
    const skills = await skillService.list();

    const response: SkillListResultPayload = {
        requestId,
        success: true,
        skills,
    };

    emitSuccess(socket, WebSocketResponseEvents.SKILL_LIST_RESULT, response);
}

export async function handlePodBindSkill(
    socket: Socket,
    payload: PodBindSkillPayload,
    requestId: string
): Promise<void> {
    const {podId, skillId} = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_SKILL_BOUND, requestId);

    if (!pod) {
        return;
    }

    const skillExists = await skillService.exists(skillId);
    if (!skillExists) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_SKILL_BOUND,
            `Skill not found: ${skillId}`,
            requestId,
            podId,
            'NOT_FOUND'
        );
        return;
    }

    if (pod.skillIds.includes(skillId)) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_SKILL_BOUND,
            `Skill ${skillId} is already bound to Pod ${podId}`,
            requestId,
            podId,
            'CONFLICT'
        );
        return;
    }

    await skillService.copySkillToPod(skillId, podId);

    podStore.addSkillId(podId, skillId);

    if (pod.repositoryId) {
        await repositorySyncService.syncRepositoryResources(pod.repositoryId);
    }

    const updatedPod = podStore.getById(podId);

    const response: PodSkillBoundPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_SKILL_BOUND, response);
    logger.log('Skill', 'Bind', `Bound skill ${skillId} to Pod ${podId}`);
}

export async function handleSkillDelete(
    socket: Socket,
    payload: SkillDeletePayload,
    requestId: string
): Promise<void> {
    const {skillId} = payload;

    await handleResourceDelete({
        socket,
        requestId,
        resourceId: skillId,
        resourceName: 'Skill',
        responseEvent: WebSocketResponseEvents.SKILL_DELETED,
        existsCheck: () => skillService.exists(skillId),
        findPodsUsing: () => podStore.findBySkillId(skillId),
        deleteNotes: () => skillNoteStore.deleteByForeignKey(skillId),
        deleteResource: () => skillService.delete(skillId),
    });
}
