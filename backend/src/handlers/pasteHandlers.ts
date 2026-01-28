import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type CanvasPasteResultPayload,
  type PasteError,
  type Pod,
  type OutputStyleNote,
  type SkillNote,
  type RepositoryNote,
  type SubAgentNote,
  type Connection,
} from '../types/index.js';
import type { CanvasPastePayload } from '../schemas/index.js';
import { podStore } from '../services/podStore.js';
import { workspaceService } from '../services/workspace/index.js';
import { claudeSessionManager } from '../services/claude/sessionManager.js';
import { noteStore } from '../services/noteStore.js';
import { skillNoteStore } from '../services/skillNoteStore.js';
import { subAgentNoteStore } from '../services/subAgentNoteStore.js';
import { repositoryNoteStore } from '../services/repositoryNoteStore.js';
import { connectionStore } from '../services/connectionStore.js';
import { repositoryService } from '../services/repositoryService.js';
import { skillService } from '../services/skillService.js';
import { subAgentService } from '../services/subAgentService.js';
import { emitSuccess, getErrorMessage } from '../utils/websocketResponse.js';

function resolveBoundPodId(
  boundToOriginalPodId: string | null,
  podIdMapping: Record<string, string>
): string | null {
  if (!boundToOriginalPodId) return null;
  return podIdMapping[boundToOriginalPodId] ?? null;
}

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

export async function handleCanvasPaste(
  socket: Socket,
  payload: CanvasPastePayload,
  requestId: string
): Promise<void> {
  const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, connections } = payload;

  const createdPods: Pod[] = [];
  const createdOutputStyleNotes: OutputStyleNote[] = [];
  const createdSkillNotes: SkillNote[] = [];
  const createdRepositoryNotes: RepositoryNote[] = [];
  const createdSubAgentNotes: SubAgentNote[] = [];
  const createdConnections: Connection[] = [];
  const podIdMapping: Record<string, string> = {};
  const errors: PasteError[] = [];

  for (const podItem of pods) {
    try {
      let finalRepositoryId = podItem.repositoryId ?? null;

      if (finalRepositoryId) {
        const exists = await repositoryService.exists(finalRepositoryId);
        if (!exists) {
          recordError(errors, 'pod', podItem.originalId, `Repository not found: ${finalRepositoryId}`, '建立 Pod 失敗');
          finalRepositoryId = null;
        }
      }

      const pod = podStore.create({
        name: podItem.name,
        type: podItem.type,
        color: podItem.color,
        x: podItem.x,
        y: podItem.y,
        rotation: podItem.rotation,
        outputStyleId: podItem.outputStyleId ?? null,
        skillIds: podItem.skillIds ?? [],
        subAgentIds: podItem.subAgentIds ?? [],
        model: podItem.model,
        repositoryId: finalRepositoryId,
      });

      const cwd = finalRepositoryId
        ? repositoryService.getRepositoryPath(finalRepositoryId)
        : pod.workspacePath;

      await workspaceService.createWorkspace(pod.id);
      await claudeSessionManager.createSession(pod.id, cwd);

      if (finalRepositoryId && podItem.skillIds && podItem.skillIds.length > 0) {
        const repositoryPath = repositoryService.getRepositoryPath(finalRepositoryId);
        for (const skillId of podItem.skillIds) {
          try {
            await skillService.copySkillToRepository(skillId, repositoryPath);
          } catch (error) {
            console.error(`[Paste] Failed to copy skill ${skillId} to repository:`, error);
          }
        }
      } else if (!finalRepositoryId && podItem.skillIds && podItem.skillIds.length > 0) {
        for (const skillId of podItem.skillIds) {
          try {
            await skillService.copySkillToPod(skillId, pod.id);
          } catch (error) {
            console.error(`[Paste] Failed to copy skill ${skillId} to pod:`, error);
          }
        }
      }

      if (finalRepositoryId && podItem.subAgentIds && podItem.subAgentIds.length > 0) {
        const repositoryPath = repositoryService.getRepositoryPath(finalRepositoryId);
        for (const subAgentId of podItem.subAgentIds) {
          try {
            await subAgentService.copySubAgentToRepository(subAgentId, repositoryPath);
          } catch (error) {
            console.error(`[Paste] Failed to copy subagent ${subAgentId} to repository:`, error);
          }
        }
      } else if (!finalRepositoryId && podItem.subAgentIds && podItem.subAgentIds.length > 0) {
        for (const subAgentId of podItem.subAgentIds) {
          try {
            await subAgentService.copySubAgentToPod(subAgentId, pod.id);
          } catch (error) {
            console.error(`[Paste] Failed to copy subagent ${subAgentId} to pod:`, error);
          }
        }
      }

      createdPods.push(pod);
      podIdMapping[podItem.originalId] = pod.id;
      console.log(`[Paste] Created Pod ${pod.id} (${pod.name})`);
    } catch (error) {
      recordError(errors, 'pod', podItem.originalId, error, `建立 Pod 失敗`);
    }
  }

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
      recordError(errors, 'outputStyleNote', noteItem.outputStyleId, error, '建立輸出風格筆記失敗');
    }
  }

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
      recordError(errors, 'skillNote', noteItem.skillId, error, '建立技能筆記失敗');
    }
  }

  for (const noteItem of repositoryNotes) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);

      const note = repositoryNoteStore.create({
        repositoryId: noteItem.repositoryId,
        name: noteItem.name,
        x: noteItem.x,
        y: noteItem.y,
        boundToPodId,
        originalPosition: noteItem.originalPosition,
      });

      createdRepositoryNotes.push(note);
      console.log(`[Paste] Created RepositoryNote ${note.id} (${note.name})`);
    } catch (error) {
      recordError(errors, 'repositoryNote', noteItem.repositoryId, error, '建立儲存庫筆記失敗');
    }
  }

  for (const noteItem of subAgentNotes) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);

      const note = subAgentNoteStore.create({
        subAgentId: noteItem.subAgentId,
        name: noteItem.name,
        x: noteItem.x,
        y: noteItem.y,
        boundToPodId,
        originalPosition: noteItem.originalPosition,
      });

      createdSubAgentNotes.push(note);
      console.log(`[Paste] Created SubAgentNote ${note.id} (${note.name})`);
    } catch (error) {
      recordError(errors, 'subAgentNote', noteItem.subAgentId, error, '建立子代理筆記失敗');
    }
  }

  for (const connItem of connections ?? []) {
    try {
      const newSourcePodId = podIdMapping[connItem.originalSourcePodId];
      const newTargetPodId = podIdMapping[connItem.originalTargetPodId];

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
      console.error(`[Paste] Failed to create connection: ${getErrorMessage(error)}`);
    }
  }

  const response: CanvasPasteResultPayload = {
    requestId,
    success: errors.length === 0,
    createdPods,
    createdOutputStyleNotes,
    createdSkillNotes,
    createdRepositoryNotes,
    createdSubAgentNotes,
    createdConnections,
    podIdMapping,
    errors,
  };

  if (errors.length > 0) {
    response.error = `貼上完成，但有 ${errors.length} 個錯誤`;
  }

  emitSuccess(socket, WebSocketResponseEvents.CANVAS_PASTE_RESULT, response);

  console.log(
    `[Paste] Completed: ${createdPods.length} pods, ${createdOutputStyleNotes.length} output style notes, ${createdSkillNotes.length} skill notes, ${createdRepositoryNotes.length} repository notes, ${createdSubAgentNotes.length} subagent notes, ${createdConnections.length} connections, ${errors.length} errors`
  );
}
