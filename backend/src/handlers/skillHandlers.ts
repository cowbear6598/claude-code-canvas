import type {Socket} from 'socket.io';
import {WebSocketResponseEvents} from '../schemas/index.js';
import type {SkillListResultPayload} from '../types/index.js';
import type {
    SkillListPayload,
    PodBindSkillPayload,
    SkillDeletePayload,
} from '../schemas/index.js';
import {skillService} from '../services/skillService.js';
import {skillNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {emitSuccess} from '../utils/websocketResponse.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createBindHandler} from './factories/createBindHandlers.js';
import {handleResourceDelete} from '../utils/handlerHelpers.js';

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

// 使用工廠函數建立 Skill 綁定處理器
const skillBindHandler = createBindHandler({
    resourceName: 'Skill',
    idField: 'skillId',
    isMultiBind: true,
    service: skillService,
    podStoreMethod: {
        bind: (canvasId, podId, skillId) => podStore.addSkillId(canvasId, podId, skillId),
    },
    getPodResourceIds: (pod) => pod.skillIds,
    copyResourceToPod: (skillId, podId, workspacePath) => skillService.copySkillToPod(skillId, podId, workspacePath),
    events: {
        bound: WebSocketResponseEvents.POD_SKILL_BOUND,
    },
});

export async function handlePodBindSkill(
    socket: Socket,
    payload: PodBindSkillPayload,
    requestId: string
): Promise<void> {
    return skillBindHandler(socket, payload, requestId);
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
        findPodsUsing: (canvasId: string) => podStore.findBySkillId(canvasId, skillId),
        deleteNotes: (canvasId: string) => skillNoteStore.deleteByForeignKey(canvasId, skillId),
        deleteResource: () => skillService.delete(skillId),
    });
}
