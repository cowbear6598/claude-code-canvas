import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type SkillListResultPayload,
  type SkillNoteCreatedPayload,
  type SkillNoteListResultPayload,
  type SkillNoteUpdatedPayload,
  type SkillNoteDeletedPayload,
  type PodSkillBoundPayload,
  type SkillDeletedPayload,
} from '../types/index.js';
import type {
  SkillListPayload,
  SkillNoteCreatePayload,
  SkillNoteListPayload,
  SkillNoteUpdatePayload,
  SkillNoteDeletePayload,
  PodBindSkillPayload,
  SkillDeletePayload,
} from '../schemas/index.js';
import { skillService } from '../services/skillService.js';
import { skillNoteStore } from '../services/skillNoteStore.js';
import { podStore } from '../services/podStore.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleSkillList(
  socket: Socket,
  _: SkillListPayload,
  requestId: string
): Promise<void> {
  const skills = await skillService.listSkills();

  const response: SkillListResultPayload = {
    requestId,
    success: true,
    skills,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_LIST_RESULT, response);
}

export async function handleSkillNoteCreate(
  socket: Socket,
  payload: SkillNoteCreatePayload,
  requestId: string
): Promise<void> {
  const { skillId, name, x, y, boundToPodId, originalPosition } = payload;

  const note = skillNoteStore.create({
    skillId,
    name,
    x,
    y,
    boundToPodId: boundToPodId ?? null,
    originalPosition: originalPosition ?? null,
  });

  const response: SkillNoteCreatedPayload = {
    requestId,
    success: true,
    note,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_CREATED, response);
}

export async function handleSkillNoteList(
  socket: Socket,
  _: SkillNoteListPayload,
  requestId: string
): Promise<void> {
  const notes = skillNoteStore.list();

  const response: SkillNoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, response);
}

export async function handleSkillNoteUpdate(
  socket: Socket,
  payload: SkillNoteUpdatePayload,
  requestId: string
): Promise<void> {
  const { noteId, x, y, boundToPodId, originalPosition } = payload;

  const existingNote = skillNoteStore.getById(noteId);
  if (!existingNote) {
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_NOTE_UPDATED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const updates: Partial<Omit<import('../types/skillNote.js').SkillNote, 'id'>> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = skillNoteStore.update(noteId, updates);

  if (!updatedNote) {
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_NOTE_UPDATED,
      `Failed to update note: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: SkillNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_UPDATED, response);
}

export async function handleSkillNoteDelete(
  socket: Socket,
  payload: SkillNoteDeletePayload,
  requestId: string
): Promise<void> {
  const { noteId } = payload;

  const note = skillNoteStore.getById(noteId);
  if (!note) {
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_NOTE_DELETED,
      `Note not found: ${noteId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const deleted = skillNoteStore.delete(noteId);
  if (!deleted) {
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_NOTE_DELETED,
      `Failed to delete note from store: ${noteId}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: SkillNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_DELETED, response);
}

export async function handlePodBindSkill(
  socket: Socket,
  payload: PodBindSkillPayload,
  requestId: string
): Promise<void> {
  const { podId, skillId } = payload;

  const pod = podStore.getById(podId);
  if (!pod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_SKILL_BOUND,
      `Pod not found: ${podId}`,
      requestId,
      podId,
      'NOT_FOUND'
    );
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
  const { skillId } = payload;

  const exists = await skillService.exists(skillId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_DELETED,
      `Skill not found: ${skillId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const podsUsingSkill = podStore.findBySkillId(skillId);
  if (podsUsingSkill.length > 0) {
    const podNames = podsUsingSkill.map((pod) => pod.name).join(', ');
    emitError(
      socket,
      WebSocketResponseEvents.SKILL_DELETED,
      `Skill is in use by pods: ${podNames}`,
      requestId,
      undefined,
      'IN_USE'
    );
    return;
  }

  const deletedNoteIds = skillNoteStore.deleteBySkillId(skillId);
  await skillService.delete(skillId);

  const response: SkillDeletedPayload = {
    requestId,
    success: true,
    skillId,
    deletedNoteIds,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_DELETED, response);
  logger.log('Skill', 'Delete', `Deleted skill ${skillId} and ${deletedNoteIds.length} notes`);
}
