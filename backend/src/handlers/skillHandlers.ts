import {WebSocketResponseEvents} from '../schemas';
import type {SkillListResultPayload, SkillImportedPayload} from '../types';
import type {
    SkillListPayload,
    PodBindSkillPayload,
    SkillDeletePayload,
    SkillImportPayload,
} from '../schemas';
import {skillService} from '../services/skillService.js';
import {skillNoteStore} from '../services/noteStores.js';
import {podStore} from '../services/podStore.js';
import {emitSuccess} from '../utils/websocketResponse.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createBindHandler} from './factories/createBindHandlers.js';
import {handleResourceDelete} from '../utils/handlerHelpers.js';
import {logger} from '../utils/logger.js';

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
    connectionId: string,
    _: SkillListPayload,
    requestId: string
): Promise<void> {
    const skills = await skillService.list();

    const response: SkillListResultPayload = {
        requestId,
        success: true,
        skills,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.SKILL_LIST_RESULT, response);
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
    connectionId: string,
    payload: PodBindSkillPayload,
    requestId: string
): Promise<void> {
    return skillBindHandler(connectionId, payload, requestId);
}

export async function handleSkillDelete(
    connectionId: string,
    payload: SkillDeletePayload,
    requestId: string
): Promise<void> {
    const {skillId} = payload;

    await handleResourceDelete({
        connectionId,
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

export async function handleSkillImport(
    connectionId: string,
    payload: SkillImportPayload,
    requestId: string
): Promise<void> {
    const {fileName, fileData, fileSize} = payload;

    const result = await skillService.import(fileName, fileData, fileSize);

    logger.log('Skill', 'Create', `Skill import - connectionId: ${connectionId}, fileName: ${fileName}, fileSize: ${fileSize}, skillId: ${result.skill.id}, isOverwrite: ${result.isOverwrite}`);

    const response: SkillImportedPayload = {
        requestId,
        success: true,
        skill: result.skill,
        isOverwrite: result.isOverwrite,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.SKILL_IMPORTED, response);
}
