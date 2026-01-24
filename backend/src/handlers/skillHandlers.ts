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
  validatePayload,
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
  try {
    validatePayload<SkillListPayload>(payload, ['requestId']);

    const { requestId } = payload;
    const skills = await skillService.listSkills();

    const response: SkillListResultPayload = {
      requestId,
      success: true,
      skills,
    };

    emitSuccess(socket, WebSocketResponseEvents.SKILL_LIST_RESULT, response);
    console.log(`[Skill] Listed ${skills.length} skills`);
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.SKILL_LIST_RESULT, payload);
  }
}

export async function handleSkillNoteCreate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<SkillNoteCreatePayload>(payload, [
      'requestId',
      'skillId',
      'name',
      'x',
      'y',
    ]);

    const { requestId, skillId, name, x, y, boundToPodId, originalPosition } =
      payload as SkillNoteCreatePayload;

    if (!validateSkillId(skillId)) {
      throw new Error('Invalid skill ID format');
    }

    if (!validateSkillName(name)) {
      throw new Error('Invalid skill name format');
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
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.SKILL_NOTE_CREATED, payload);
  }
}

export async function handleSkillNoteList(socket: Socket, payload: unknown): Promise<void> {
  try {
    validatePayload<SkillNoteListPayload>(payload, ['requestId']);

    const { requestId } = payload;
    const notes = skillNoteStore.list();

    const response: SkillNoteListResultPayload = {
      requestId,
      success: true,
      notes,
    };

    emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, response);
    console.log(`[SkillNote] Listed ${notes.length} notes`);
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.SKILL_NOTE_LIST_RESULT, payload);
  }
}

export async function handleSkillNoteUpdate(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<SkillNoteUpdatePayload>(payload, ['requestId', 'noteId']);

    const { requestId, noteId, x, y, boundToPodId, originalPosition } =
      payload as SkillNoteUpdatePayload;

    const existingNote = skillNoteStore.getById(noteId);
    if (!existingNote) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const updates: Partial<Omit<import('../types/skillNote.js').SkillNote, 'id'>> = {};
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (boundToPodId !== undefined) updates.boundToPodId = boundToPodId;
    if (originalPosition !== undefined) updates.originalPosition = originalPosition;

    const updatedNote = skillNoteStore.update(noteId, updates);

    if (!updatedNote) {
      throw new Error(`Failed to update note: ${noteId}`);
    }

    const response: SkillNoteUpdatedPayload = {
      requestId,
      success: true,
      note: updatedNote,
    };

    emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_UPDATED, response);
    console.log(`[SkillNote] Updated note ${noteId}`);
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.SKILL_NOTE_UPDATED, payload);
  }
}

export async function handleSkillNoteDelete(
  socket: Socket,
  payload: unknown
): Promise<void> {
  try {
    validatePayload<SkillNoteDeletePayload>(payload, ['requestId', 'noteId']);

    const { requestId, noteId } = payload;
    const note = skillNoteStore.getById(noteId);

    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const deleted = skillNoteStore.delete(noteId);
    if (!deleted) {
      throw new Error(`Failed to delete note from store: ${noteId}`);
    }

    const response: SkillNoteDeletedPayload = {
      requestId,
      success: true,
      noteId,
    };

    emitSuccess(socket, WebSocketResponseEvents.SKILL_NOTE_DELETED, response);
    console.log(`[SkillNote] Deleted note ${noteId}`);
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.SKILL_NOTE_DELETED, payload);
  }
}

export async function handlePodBindSkill(socket: Socket, payload: unknown): Promise<void> {
  try {
    validatePayload<PodBindSkillPayload>(payload, ['requestId', 'podId', 'skillId']);

    const { requestId, podId, skillId } = payload;
    const pod = podStore.getById(podId);

    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
    }

    const skillExists = await skillService.exists(skillId);
    if (!skillExists) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (pod.skillIds.includes(skillId)) {
      throw new Error(`Skill ${skillId} is already bound to Pod ${podId}`);
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
  } catch (error) {
    handleError(socket, error, WebSocketResponseEvents.POD_SKILL_BOUND, payload, true);
  }
}
