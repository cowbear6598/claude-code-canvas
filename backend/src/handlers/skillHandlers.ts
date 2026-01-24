import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type SkillListPayload,
  type SkillNoteCreatePayload,
  type SkillNoteListPayload,
  type SkillNoteUpdatePayload,
  type SkillNoteDeletePayload,
  type PodBindSkillPayload,
  type SkillListResultPayload,
  type SkillNoteCreatedPayload,
  type SkillNoteListResultPayload,
  type SkillNoteUpdatedPayload,
  type SkillNoteDeletedPayload,
  type PodSkillBoundPayload,
} from '../types/index.js';
import { skillService } from '../services/skillService.js';
import { skillNoteStore } from '../services/skillNoteStore.js';
import { podStore } from '../services/podStore.js';
import {
  emitSuccess,
  emitError,
  tryValidatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';
import { validateSkillId, validateSkillName } from '../utils/pathValidator.js';

/**
 * Extract requestId from unknown payload for error handling
 */
function extractRequestId(payload: unknown): string | undefined {
  return typeof payload === 'object' && payload && 'requestId' in payload
    ? (payload.requestId as string)
    : undefined;
}

/**
 * Extract podId from unknown payload for error handling
 */
function extractPodId(payload: unknown): string | undefined {
  return typeof payload === 'object' && payload && 'podId' in payload
    ? (payload.podId as string)
    : undefined;
}

/**
 * Handle errors in skill handlers
 */
function handleError(
  socket: Socket,
  error: unknown,
  event: WebSocketResponseEvents,
  payload: unknown,
  includePodId = false
): void {
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);
  const requestId = extractRequestId(payload);
  const podId = includePodId ? extractPodId(payload) : undefined;

  emitError(socket, event, errorMessage, requestId, podId, errorCode);

  const eventName = event.split(':').slice(0, -1).join(':');
  console.error(`[${eventName}] Error: ${errorMessage}`);
}

export async function handleSkillList(socket: Socket, payload: unknown): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<SkillListPayload>(payload, ['requestId']);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.SKILL_LIST_RESULT, payload);
    return;
  }

  const { requestId } = validation.data!;
  const skills = await skillService.listSkills();

  const response: SkillListResultPayload = {
    requestId,
    success: true,
    skills,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_LIST_RESULT, response);
  console.log(`[Skill] Listed ${skills.length} skills`);
}

export async function handleSkillNoteCreate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<SkillNoteCreatePayload>(payload, [
    'requestId',
    'skillId',
    'name',
    'x',
    'y',
  ]);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.SKILL_NOTE_CREATED, payload);
    return;
  }

  const { requestId, skillId, name, x, y, boundToPodId, originalPosition } = validation.data!;

  // Validate skillId format
  if (!validateSkillId(skillId)) {
    handleError(socket, new Error('Invalid skill ID format'), WebSocketResponseEvents.SKILL_NOTE_CREATED, payload);
    return;
  }

  // Validate skill name format
  if (!validateSkillName(name)) {
    handleError(socket, new Error('Invalid skill name format'), WebSocketResponseEvents.SKILL_NOTE_CREATED, payload);
    return;
  }

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
  console.log(`[SkillNote] Created note ${note.id} (${note.name})`);
}

export async function handleSkillNoteList(socket: Socket, payload: unknown): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<SkillNoteListPayload>(payload, ['requestId']);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, payload);
    return;
  }

  const { requestId } = validation.data!;
  const notes = skillNoteStore.list();

  const response: SkillNoteListResultPayload = {
    requestId,
    success: true,
    notes,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, response);
  console.log(`[SkillNote] Listed ${notes.length} notes`);
}

export async function handleSkillNoteUpdate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<SkillNoteUpdatePayload>(payload, ['requestId', 'noteId']);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.SKILL_NOTE_UPDATED, payload);
    return;
  }

  const { requestId, noteId, x, y, boundToPodId, originalPosition } = validation.data!;

  // Check if note exists
  const existingNote = skillNoteStore.getById(noteId);
  if (!existingNote) {
    handleError(socket, new Error(`Note not found: ${noteId}`), WebSocketResponseEvents.SKILL_NOTE_UPDATED, payload);
    return;
  }

  const updates: Partial<Omit<import('../types/skillNote.js').SkillNote, 'id'>> = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
  if (originalPosition !== undefined) updates.originalPosition = originalPosition;

  const updatedNote = skillNoteStore.update(noteId, updates);

  if (!updatedNote) {
    handleError(socket, new Error(`Failed to update note: ${noteId}`), WebSocketResponseEvents.SKILL_NOTE_UPDATED, payload);
    return;
  }

  const response: SkillNoteUpdatedPayload = {
    requestId,
    success: true,
    note: updatedNote,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_UPDATED, response);
  console.log(`[SkillNote] Updated note ${noteId}`);
}

export async function handleSkillNoteDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<SkillNoteDeletePayload>(payload, ['requestId', 'noteId']);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.SKILL_NOTE_DELETED, payload);
    return;
  }

  const { requestId, noteId } = validation.data!;

  // Check if note exists
  const note = skillNoteStore.getById(noteId);
  if (!note) {
    handleError(socket, new Error(`Note not found: ${noteId}`), WebSocketResponseEvents.SKILL_NOTE_DELETED, payload);
    return;
  }

  const deleted = skillNoteStore.delete(noteId);
  if (!deleted) {
    handleError(socket, new Error(`Failed to delete note from store: ${noteId}`), WebSocketResponseEvents.SKILL_NOTE_DELETED, payload);
    return;
  }

  const response: SkillNoteDeletedPayload = {
    requestId,
    success: true,
    noteId,
  };

  emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_DELETED, response);
  console.log(`[SkillNote] Deleted note ${noteId}`);
}

export async function handlePodBindSkill(socket: Socket, payload: unknown): Promise<void> {
  // Validate payload
  const validation = tryValidatePayload<PodBindSkillPayload>(payload, ['requestId', 'podId', 'skillId']);

  if (!validation.success) {
    handleError(socket, new Error(validation.error), WebSocketResponseEvents.POD_SKILL_BOUND, payload, true);
    return;
  }

  const { requestId, podId, skillId } = validation.data!;

  // Check if Pod exists
  const pod = podStore.getById(podId);
  if (!pod) {
    handleError(socket, new Error(`Pod not found: ${podId}`), WebSocketResponseEvents.POD_SKILL_BOUND, payload, true);
    return;
  }

  // Check if Skill exists
  const skillExists = await skillService.exists(skillId);
  if (!skillExists) {
    handleError(socket, new Error(`Skill not found: ${skillId}`), WebSocketResponseEvents.POD_SKILL_BOUND, payload, true);
    return;
  }

  // Check if Skill is already bound
  if (pod.skillIds.includes(skillId)) {
    handleError(socket, new Error(`Skill ${skillId} is already bound to Pod ${podId}`), WebSocketResponseEvents.POD_SKILL_BOUND, payload, true);
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
  console.log(`[Skill] Bound skill ${skillId} to Pod ${podId}`);
}
