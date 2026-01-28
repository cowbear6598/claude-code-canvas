import type {
  Pod,
  OutputStyleNote,
  SkillNote,
  RepositoryNote,
  SubAgentNote,
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
import { noteStore } from '../../services/noteStore.js';
import { skillNoteStore } from '../../services/skillNoteStore.js';
import { subAgentNoteStore } from '../../services/subAgentNoteStore.js';
import { repositoryNoteStore } from '../../services/repositoryNoteStore.js';
import { connectionStore } from '../../services/connectionStore.js';
import { repositoryService } from '../../services/repositoryService.js';
import { skillService } from '../../services/skillService.js';
import { subAgentService } from '../../services/subAgentService.js';
import { getErrorMessage } from '../../utils/websocketResponse.js';
import { logger } from '../../utils/logger.js';

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

async function copySkillsToPath(skillIds: string[], targetPath: string, isRepository: boolean): Promise<void> {
  for (const skillId of skillIds) {
    try {
      if (isRepository) {
        await skillService.copySkillToRepository(skillId, targetPath);
      } else {
        await skillService.copySkillToPod(skillId, targetPath);
      }
    } catch (error) {
      logger.error('Paste', 'Error', `Failed to copy skill ${skillId} to ${isRepository ? 'repository' : 'pod'}`, error);
    }
  }
}

async function copySubAgentsToPath(subAgentIds: string[], targetPath: string, isRepository: boolean): Promise<void> {
  for (const subAgentId of subAgentIds) {
    try {
      if (isRepository) {
        await subAgentService.copySubAgentToRepository(subAgentId, targetPath);
      } else {
        await subAgentService.copySubAgentToPod(subAgentId, targetPath);
      }
    } catch (error) {
      logger.error('Paste', 'Error', `Failed to copy subagent ${subAgentId} to ${isRepository ? 'repository' : 'pod'}`, error);
    }
  }
}

export async function createPastedPods(
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

      if (podItem.skillIds && podItem.skillIds.length > 0) {
        const targetPath = finalRepositoryId ? repositoryService.getRepositoryPath(finalRepositoryId) : pod.id;
        await copySkillsToPath(podItem.skillIds, targetPath, !!finalRepositoryId);
      }

      if (podItem.subAgentIds && podItem.subAgentIds.length > 0) {
        const targetPath = finalRepositoryId ? repositoryService.getRepositoryPath(finalRepositoryId) : pod.id;
        await copySubAgentsToPath(podItem.subAgentIds, targetPath, !!finalRepositoryId);
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
  create: (params: {
    [K in keyof T]: T[K];
  }) => T;
};

type NoteCreateParams<T extends { id: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }> = Omit<T, 'id'>;

export function createPastedNotes<
  TNoteItem extends { boundToOriginalPodId: string | null },
  TNote extends { id: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }
>(
  noteItems: TNoteItem[],
  noteStore: NoteStoreType<TNote>,
  podIdMapping: Record<string, string>,
  noteType: 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote',
  getResourceId: (item: TNoteItem) => string,
  createParams: (item: TNoteItem, boundToPodId: string | null) => NoteCreateParams<TNote>
): { notes: TNote[]; errors: PasteError[] } {
  const createdNotes: TNote[] = [];
  const errors: PasteError[] = [];

  for (const noteItem of noteItems) {
    try {
      const boundToPodId = resolveBoundPodId(noteItem.boundToOriginalPodId, podIdMapping);
      const params = createParams(noteItem, boundToPodId) as Parameters<typeof noteStore.create>[0];
      const note = noteStore.create(params);

      createdNotes.push(note);

      logger.log('Paste', 'Create', `Created ${noteType} ${note.id} (${note.name})`);
    } catch (error) {
      const resourceId = getResourceId(noteItem);
      const errorTypeMap = {
        outputStyleNote: 'outputStyleNote' as const,
        skillNote: 'skillNote' as const,
        repositoryNote: 'repositoryNote' as const,
        subAgentNote: 'subAgentNote' as const,
      };
      recordError(errors, errorTypeMap[noteType], resourceId, error, `建立${noteType}失敗`);
    }
  }

  return { notes: createdNotes, errors };
}

export function createPastedConnections(
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

      const newConnection = connectionStore.create({
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

export function createPastedOutputStyleNotes(
  noteItems: OutputStyleNoteItem[],
  podIdMapping: Record<string, string>
): { notes: OutputStyleNote[]; errors: PasteError[] } {
  return createPastedNotes<OutputStyleNoteItem, OutputStyleNote>(
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
  noteItems: SkillNoteItem[],
  podIdMapping: Record<string, string>
): { notes: SkillNote[]; errors: PasteError[] } {
  return createPastedNotes<SkillNoteItem, SkillNote>(
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
  noteItems: RepositoryNoteItem[],
  podIdMapping: Record<string, string>
): { notes: RepositoryNote[]; errors: PasteError[] } {
  return createPastedNotes<RepositoryNoteItem, RepositoryNote>(
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
  noteItems: SubAgentNoteItem[],
  podIdMapping: Record<string, string>
): { notes: SubAgentNote[]; errors: PasteError[] } {
  return createPastedNotes<SubAgentNoteItem, SubAgentNote>(
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
