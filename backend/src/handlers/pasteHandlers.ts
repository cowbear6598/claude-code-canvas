// Canvas Paste WebSocket Handler
// Handles batch paste operations for Pods and Notes

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type CanvasPasteResultPayload,
  type PasteError,
  type Pod,
  type OutputStyleNote,
  type SkillNote,
  type Connection,
} from '../types/index.js';
import type { CanvasPastePayload } from '../schemas/index.js';
import { podStore } from '../services/podStore.js';
import { workspaceService } from '../services/workspace/index.js';
import { claudeSessionManager } from '../services/claude/sessionManager.js';
import { noteStore } from '../services/noteStore.js';
import { skillNoteStore } from '../services/skillNoteStore.js';
import { connectionStore } from '../services/connectionStore.js';
import { emitSuccess, getErrorMessage } from '../utils/websocketResponse.js';

/**
 * Map original pod ID to new pod ID for note binding
 */
function resolveBoundPodId(
  boundToOriginalPodId: string | null,
  podIdMapping: Record<string, string>
): string | null {
  if (!boundToOriginalPodId) return null;
  return podIdMapping[boundToOriginalPodId] ?? null;
}

/**
 * Record error in errors array and log it
 */
function recordError(
  errors: PasteError[],
  type: PasteError['type'],
  originalId: string,
  error: unknown,
  context: string
): void {
  const errorMessage = getErrorMessage(error);
  errors.push({ type, originalId, error: errorMessage });
  console.error(`[Paste] ${context}: ${errorMessage}`);
}

/**
 * Handle canvas paste request
 */
export async function handleCanvasPaste(
  socket: Socket,
  payload: CanvasPastePayload,
  requestId: string
): Promise<void> {
  const { pods, outputStyleNotes, skillNotes, connections } = payload;

  const createdPods: Pod[] = [];
  const createdOutputStyleNotes: OutputStyleNote[] = [];
  const createdSkillNotes: SkillNote[] = [];
  const createdConnections: Connection[] = [];
  const podIdMapping: Record<string, string> = {};
  const errors: PasteError[] = [];

  // Process PODs - workspace and session creation involves third-party services
  for (const podItem of pods) {
    try {
      const pod = podStore.create({
        name: podItem.name,
        type: podItem.type,
        color: podItem.color,
        x: podItem.x,
        y: podItem.y,
        rotation: podItem.rotation,
        outputStyleId: podItem.outputStyleId ?? null,
        skillIds: podItem.skillIds ?? [],
        model: podItem.model,
      });

      await workspaceService.createWorkspace(pod.id);
      await claudeSessionManager.createSession(pod.id, pod.workspacePath);

      createdPods.push(pod);
      podIdMapping[podItem.originalId] = pod.id;
      console.log(`[Paste] Created Pod ${pod.id} (${pod.name})`);
    } catch (error) {
      recordError(errors, 'pod', podItem.originalId, error, `Failed to create Pod ${podItem.originalId}`);
    }
  }

  // Process OutputStyleNotes
  for (const noteItem of outputStyleNotes) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);

      const note = noteStore.create({
        outputStyleId: noteItem.outputStyleId,
        name: noteItem.name,
        x: noteItem.x,
        y: noteItem.y,
        boundToPodId,
        originalPosition: noteItem.originalPosition,
      });

      createdOutputStyleNotes.push(note);
      console.log(`[Paste] Created OutputStyleNote ${note.id} (${note.name})`);
    } catch (error) {
      recordError(errors, 'outputStyleNote', noteItem.outputStyleId, error, 'Failed to create OutputStyleNote');
    }
  }

  // Process SkillNotes
  for (const noteItem of skillNotes) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);

      const note = skillNoteStore.create({
        skillId: noteItem.skillId,
        name: noteItem.name,
        x: noteItem.x,
        y: noteItem.y,
        boundToPodId,
        originalPosition: noteItem.originalPosition,
      });

      createdSkillNotes.push(note);
      console.log(`[Paste] Created SkillNote ${note.id} (${note.name})`);
    } catch (error) {
      recordError(errors, 'skillNote', noteItem.skillId, error, 'Failed to create SkillNote');
    }
  }

  // Process Connections
  for (const connItem of connections ?? []) {
    try {
      // 轉換 POD ID
      const newSourcePodId = podIdMapping[connItem.originalSourcePodId];
      const newTargetPodId = podIdMapping[connItem.originalTargetPodId];

      // 兩端 POD 都必須成功建立
      if (!newSourcePodId || !newTargetPodId) {
        console.log(`[Paste] Skipping connection: source or target pod not created`);
        continue;
      }

      const newConnection = connectionStore.create({
        sourcePodId: newSourcePodId,
        sourceAnchor: connItem.sourceAnchor,
        targetPodId: newTargetPodId,
        targetAnchor: connItem.targetAnchor,
        autoTrigger: connItem.autoTrigger ?? false,
      });

      createdConnections.push(newConnection);
      console.log(`[Paste] Created Connection ${newConnection.id} (${newSourcePodId} -> ${newTargetPodId})`);
    } catch (error) {
      // 記錄錯誤但繼續處理
      console.error(`[Paste] Failed to create connection: ${getErrorMessage(error)}`);
    }
  }

  const response: CanvasPasteResultPayload = {
    requestId,
    success: errors.length === 0,
    createdPods,
    createdOutputStyleNotes,
    createdSkillNotes,
    createdConnections,
    podIdMapping,
    errors,
  };

  if (errors.length > 0) {
    response.error = `Paste completed with ${errors.length} error(s)`;
  }

  emitSuccess(socket, WebSocketResponseEvents.CANVAS_PASTE_RESULT, response);

  console.log(
    `[Paste] Completed: ${createdPods.length} pods, ${createdOutputStyleNotes.length} output style notes, ${createdSkillNotes.length} skill notes, ${createdConnections.length} connections, ${errors.length} errors`
  );
}
