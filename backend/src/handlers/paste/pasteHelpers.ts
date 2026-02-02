import type {
  Pod,
  OutputStyleNote,
  SkillNote,
  RepositoryNote,
  SubAgentNote,
  CommandNote,
  Connection,
  PasteError,
} from '../../types/index.js';
import type {
  CanvasPastePayload,
  PastePodItem,
} from '../../schemas/index.js';
import { podStore } from '../../services/podStore.js';
import { workspaceService } from '../../services/workspace/index.js';
import { claudeSessionManager } from '../../services/claude/sessionManager.js';
import { noteStore, skillNoteStore, subAgentNoteStore, repositoryNoteStore, commandNoteStore } from '../../services/noteStores.js';
import { connectionStore } from '../../services/connectionStore.js';
import { repositoryService } from '../../services/repositoryService.js';
import { getErrorMessage } from '../../utils/websocketResponse.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

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
  logger.error('Paste', 'Error', `${context}: ${errorMessage}`);
}

async function copyClaudeDir(srcCwd: string, destCwd: string): Promise<void> {
  const srcClaudeDir = path.join(srcCwd, '.claude');
  const destClaudeDir = path.join(destCwd, '.claude');

  try {
    await fs.access(srcClaudeDir);
  } catch {
    return; // 原始 .claude 不存在，不需要複製
  }

  try {
    await fs.cp(srcClaudeDir, destClaudeDir, { recursive: true });
  } catch (error) {
    logger.error('Paste', 'Error', `Failed to copy .claude directory: ${error}`);
  }
}

export async function createPastedPods(
  canvasId: string,
  pods: PastePodItem[],
  podIdMapping: Record<string, string>,
  errors: PasteError[]
): Promise<Pod[]> {
  const createdPods: Pod[] = [];

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

      const pod = podStore.create(canvasId, {
        name: podItem.name,
        color: podItem.color,
        x: podItem.x,
        y: podItem.y,
        rotation: podItem.rotation,
        outputStyleId: podItem.outputStyleId ?? null,
        skillIds: podItem.skillIds ?? [],
        subAgentIds: podItem.subAgentIds ?? [],
        model: podItem.model,
        repositoryId: finalRepositoryId,
        commandId: podItem.commandId ?? null,
      });

      const cwd = finalRepositoryId
        ? repositoryService.getRepositoryPath(finalRepositoryId)
        : pod.workspacePath;

      await workspaceService.createWorkspace(pod.id);
      await claudeSessionManager.createSession(pod.id, cwd);

      // 從原始 Pod 的工作目錄複製 .claude/ 到新 Pod 的工作目錄
      const originalPod = podStore.getById(canvasId, podItem.originalId);
      if (originalPod) {
        const srcCwd = originalPod.repositoryId
          ? repositoryService.getRepositoryPath(originalPod.repositoryId)
          : originalPod.workspacePath;
        const destCwd = finalRepositoryId
          ? repositoryService.getRepositoryPath(finalRepositoryId)
          : pod.workspacePath;
        await copyClaudeDir(srcCwd, destCwd);
      }

      createdPods.push(pod);
      podIdMapping[podItem.originalId] = pod.id;

      logger.log('Paste', 'Create', `Created Pod ${pod.id} (${pod.name})`);
    } catch (error) {
      recordError(errors, 'pod', podItem.originalId, error, '建立 Pod 失敗');
    }
  }

  return createdPods;
}

type NoteStoreType<T> = {
  create: (canvasId: string, params: {
    [K in keyof T]: T[K];
  }) => T;
};

type NoteCreateParams<T extends { id: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }> = Omit<T, 'id'>;

export function createPastedNotes<
  TNoteItem extends { boundToOriginalPodId: string | null },
  TNote extends { id: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }
>(
  canvasId: string,
  noteItems: TNoteItem[],
  noteStore: NoteStoreType<TNote>,
  podIdMapping: Record<string, string>,
  noteType: 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote',
  getResourceId: (item: TNoteItem) => string,
  createParams: (item: TNoteItem, boundToPodId: string | null) => NoteCreateParams<TNote>
): { notes: TNote[]; errors: PasteError[] } {
  const createdNotes: TNote[] = [];
  const errors: PasteError[] = [];

  for (const noteItem of noteItems) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);
      const params = createParams(noteItem, boundToPodId) as Parameters<typeof noteStore.create>[1];
      const note = noteStore.create(canvasId, params);

      createdNotes.push(note);

      logger.log('Paste', 'Create', `Created ${noteType} ${note.id} (${note.name})`);
    } catch (error) {
      const resourceId = getResourceId(noteItem);
      const errorTypeMap = {
        outputStyleNote: 'outputStyleNote' as const,
        skillNote: 'skillNote' as const,
        repositoryNote: 'repositoryNote' as const,
        subAgentNote: 'subAgentNote' as const,
        commandNote: 'commandNote' as const,
      };
      recordError(errors, errorTypeMap[noteType], resourceId, error, `建立${noteType}失敗`);
    }
  }

  return { notes: createdNotes, errors };
}

export function createPastedConnections(
  canvasId: string,
  connections: CanvasPastePayload['connections'],
  podIdMapping: Record<string, string>
): Connection[] {
  const createdConnections: Connection[] = [];

  for (const connItem of connections ?? []) {
    try {
      const newSourcePodId = podIdMapping[connItem.originalSourcePodId];
      const newTargetPodId = podIdMapping[connItem.originalTargetPodId];

      if (!newSourcePodId || !newTargetPodId) {
        continue;
      }

      const newConnection = connectionStore.create(canvasId, {
        sourcePodId: newSourcePodId,
        sourceAnchor: connItem.sourceAnchor,
        targetPodId: newTargetPodId,
        targetAnchor: connItem.targetAnchor,
        autoTrigger: connItem.autoTrigger ?? false,
      });

      createdConnections.push(newConnection);

      logger.log('Paste', 'Create', `Created Connection ${newConnection.id} (${newSourcePodId} -> ${newTargetPodId})`);
    } catch (error) {
      logger.error('Paste', 'Error', `Failed to create connection: ${getErrorMessage(error)}`);
    }
  }

  return createdConnections;
}

type OutputStyleNoteItem = { boundToOriginalPodId: string | null; outputStyleId: string; name: string; x: number; y: number; originalPosition: { x: number; y: number } | null };
type SkillNoteItem = { boundToOriginalPodId: string | null; skillId: string; name: string; x: number; y: number; originalPosition: { x: number; y: number } | null };
type RepositoryNoteItem = { boundToOriginalPodId: string | null; repositoryId: string; name: string; x: number; y: number; originalPosition: { x: number; y: number } | null };
type SubAgentNoteItem = { boundToOriginalPodId: string | null; subAgentId: string; name: string; x: number; y: number; originalPosition: { x: number; y: number } | null };
type CommandNoteItem = { boundToOriginalPodId: string | null; commandId: string; name: string; x: number; y: number; originalPosition: { x: number; y: number } | null };

export function createPastedOutputStyleNotes(
  canvasId: string,
  noteItems: OutputStyleNoteItem[],
  podIdMapping: Record<string, string>
): { notes: OutputStyleNote[]; errors: PasteError[] } {
  return createPastedNotes<OutputStyleNoteItem, OutputStyleNote>(
    canvasId,
    noteItems,
    noteStore,
    podIdMapping,
    'outputStyleNote',
    (item) => item.outputStyleId,
    (item, boundToPodId) => ({
      outputStyleId: item.outputStyleId,
      name: item.name,
      x: item.x,
      y: item.y,
      boundToPodId,
      originalPosition: item.originalPosition,
    })
  );
}

export function createPastedSkillNotes(
  canvasId: string,
  noteItems: SkillNoteItem[],
  podIdMapping: Record<string, string>
): { notes: SkillNote[]; errors: PasteError[] } {
  return createPastedNotes<SkillNoteItem, SkillNote>(
    canvasId,
    noteItems,
    skillNoteStore,
    podIdMapping,
    'skillNote',
    (item) => item.skillId,
    (item, boundToPodId) => ({
      skillId: item.skillId,
      name: item.name,
      x: item.x,
      y: item.y,
      boundToPodId,
      originalPosition: item.originalPosition,
    })
  );
}

export function createPastedRepositoryNotes(
  canvasId: string,
  noteItems: RepositoryNoteItem[],
  podIdMapping: Record<string, string>
): { notes: RepositoryNote[]; errors: PasteError[] } {
  return createPastedNotes<RepositoryNoteItem, RepositoryNote>(
    canvasId,
    noteItems,
    repositoryNoteStore,
    podIdMapping,
    'repositoryNote',
    (item) => item.repositoryId,
    (item, boundToPodId) => ({
      repositoryId: item.repositoryId,
      name: item.name,
      x: item.x,
      y: item.y,
      boundToPodId,
      originalPosition: item.originalPosition,
    })
  );
}

export function createPastedSubAgentNotes(
  canvasId: string,
  noteItems: SubAgentNoteItem[],
  podIdMapping: Record<string, string>
): { notes: SubAgentNote[]; errors: PasteError[] } {
  return createPastedNotes<SubAgentNoteItem, SubAgentNote>(
    canvasId,
    noteItems,
    subAgentNoteStore,
    podIdMapping,
    'subAgentNote',
    (item) => item.subAgentId,
    (item, boundToPodId) => ({
      subAgentId: item.subAgentId,
      name: item.name,
      x: item.x,
      y: item.y,
      boundToPodId,
      originalPosition: item.originalPosition,
    })
  );
}

export function createPastedCommandNotes(
  canvasId: string,
  noteItems: CommandNoteItem[],
  podIdMapping: Record<string, string>
): { notes: CommandNote[]; errors: PasteError[] } {
  return createPastedNotes<CommandNoteItem, CommandNote>(
    canvasId,
    noteItems,
    commandNoteStore,
    podIdMapping,
    'commandNote',
    (item) => item.commandId,
    (item, boundToPodId) => ({
      commandId: item.commandId,
      name: item.name,
      x: item.x,
      y: item.y,
      boundToPodId,
      originalPosition: item.originalPosition,
    })
  );
}
