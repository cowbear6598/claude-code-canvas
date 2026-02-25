
import { WebSocketResponseEvents } from '../schemas';
import type {
  RepositoryListResultPayload,
  RepositoryCreatedPayload,
  PodRepositoryBoundPayload,
  PodRepositoryUnboundPayload,
} from '../types';
import type {
  RepositoryListPayload,
  RepositoryCreatePayload,
  PodBindRepositoryPayload,
  PodUnbindRepositoryPayload,
  RepositoryDeletePayload,
} from '../schemas';
import { repositoryService } from '../services/repositoryService.js';
import { repositoryNoteStore } from '../services/noteStores.js';
import { podStore } from '../services/podStore.js';
import { socketService } from '../services/socketService.js';
import { gitService } from '../services/workspace/gitService.js';
import { repositorySyncService } from '../services/repositorySyncService.js';
import { skillService } from '../services/skillService.js';
import { subAgentService } from '../services/subAgentService.js';
import { commandService } from '../services/commandService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { clearPodMessages } from './repository/repositoryBindHelpers.js';
import { logger } from '../utils/logger.js';
import { createNoteHandlers } from './factories/createNoteHandlers.js';
import { validatePod, handleResourceDelete, withCanvasId } from '../utils/handlerHelpers.js';
import { validateRepositoryExists } from '../utils/validators.js';

const repositoryNoteHandlers = createNoteHandlers({
  noteStore: repositoryNoteStore,
  events: {
    created: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
    listResult: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
    updated: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
    deleted: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
  },
  foreignKeyField: 'repositoryId',
  entityName: 'Repository',
  validateBeforeCreate: (repositoryId) => repositoryService.exists(repositoryId),
});

export const handleRepositoryNoteCreate = repositoryNoteHandlers.handleNoteCreate;
export const handleRepositoryNoteList = repositoryNoteHandlers.handleNoteList;
export const handleRepositoryNoteUpdate = repositoryNoteHandlers.handleNoteUpdate;
export const handleRepositoryNoteDelete = repositoryNoteHandlers.handleNoteDelete;

export async function handleRepositoryList(
  connectionId: string,
  _: RepositoryListPayload,
  requestId: string
): Promise<void> {
  const repositories = await repositoryService.list();

  const response: RepositoryListResultPayload = {
    requestId,
    success: true,
    repositories,
  };

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_LIST_RESULT, response);
}

export async function handleRepositoryCreate(
  connectionId: string,
  payload: RepositoryCreatePayload,
  requestId: string
): Promise<void> {
  const { name } = payload;

  const exists = await repositoryService.exists(name);
  if (exists) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_CREATED,
      `Repository 已存在: ${name}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );
    return;
  }

  const repository = await repositoryService.create(name);

  const response: RepositoryCreatedPayload = {
    requestId,
    success: true,
    repository,
  };

  socketService.emitToConnection(connectionId, WebSocketResponseEvents.REPOSITORY_CREATED, response);

  logger.log('Repository', 'Create', `Created repository ${repository.id}`);
}

export const handlePodBindRepository = withCanvasId<PodBindRepositoryPayload>(
  WebSocketResponseEvents.POD_REPOSITORY_BOUND,
  async (connectionId: string, canvasId: string, payload: PodBindRepositoryPayload, requestId: string): Promise<void> => {
    const { podId, repositoryId } = payload;

    const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_REPOSITORY_BOUND, requestId);
    if (!pod) {
      return;
    }

    const validateResult = await validateRepositoryExists(repositoryId);
    if (!validateResult.success) {
      emitError(
        connectionId,
        WebSocketResponseEvents.POD_REPOSITORY_BOUND,
        validateResult.error!,
        requestId,
        undefined,
        'NOT_FOUND'
      );
      return;
    }

    const oldRepositoryId = pod.repositoryId;

    podStore.setRepositoryId(canvasId, podId, repositoryId);
    podStore.setClaudeSessionId(canvasId, podId, '');

    await repositorySyncService.syncRepositoryResources(repositoryId);

    if (oldRepositoryId && oldRepositoryId !== repositoryId) {
      await repositorySyncService.syncRepositoryResources(oldRepositoryId);
    }

    if (!oldRepositoryId) {
      const podWorkspacePath = pod.workspacePath;
      const deleteOperations = [
        commandService.deleteCommandFromPath(podWorkspacePath),
        skillService.deleteSkillsFromPath(podWorkspacePath),
        subAgentService.deleteSubAgentsFromPath(podWorkspacePath),
      ];

      const results = await Promise.allSettled(deleteOperations);
      const operationNames = ['commands', 'skills', 'subagents'];

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error('Repository', 'Bind', `Failed to delete ${operationNames[index]} from Pod ${podId} workspace`, result.reason);
        }
      });
    }

    await clearPodMessages(connectionId, podId);

    const updatedPod = podStore.getById(canvasId, podId);

    const response: PodRepositoryBoundPayload = {
      requestId,
      canvasId,
      success: true,
      pod: updatedPod,
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_REPOSITORY_BOUND, response);

    logger.log('Repository', 'Bind', `Bound repository ${repositoryId} to Pod ${podId}`);
  }
);

export const handlePodUnbindRepository = withCanvasId<PodUnbindRepositoryPayload>(
  WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
  async (connectionId: string, canvasId: string, payload: PodUnbindRepositoryPayload, requestId: string): Promise<void> => {
    const { podId } = payload;

    const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, requestId);
    if (!pod) {
      return;
    }

    const oldRepositoryId = pod.repositoryId;

    podStore.setRepositoryId(canvasId, podId, null);
    podStore.setClaudeSessionId(canvasId, podId, '');

    if (oldRepositoryId) {
      await repositorySyncService.syncRepositoryResources(oldRepositoryId);
    }

    const copyOperations = [
      ...pod.skillIds.map(skillId =>
        skillService.copySkillToPod(skillId, podId, pod.workspacePath)
          .then(() => ({ type: 'skill', id: skillId }))
      ),
      ...pod.subAgentIds.map(subAgentId =>
        subAgentService.copySubAgentToPod(subAgentId, podId, pod.workspacePath)
          .then(() => ({ type: 'subagent', id: subAgentId }))
      ),
      ...(pod.commandId ? [
        commandService.copyCommandToPod(pod.commandId, podId, pod.workspacePath)
          .then(() => ({ type: 'command', id: pod.commandId }))
      ] : []),
    ];

    const results = await Promise.allSettled(copyOperations);

    results.forEach((result) => {
      if (result.status === 'rejected') {
        logger.error('Repository', 'Unbind', `Failed to copy resource to Pod ${podId}`, result.reason);
      }
    });

    await clearPodMessages(connectionId, podId);

    const updatedPod = podStore.getById(canvasId, podId);

    const response: PodRepositoryUnboundPayload = {
      requestId,
      canvasId,
      success: true,
      pod: updatedPod,
    };

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, response);

    logger.log('Repository', 'Unbind', `Unbound repository from Pod ${podId}`);
  }
);

export async function handleRepositoryDelete(
  connectionId: string,
  payload: RepositoryDeletePayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const metadata = repositoryService.getMetadata(repositoryId);

  await handleResourceDelete({
    connectionId,
    requestId,
    resourceId: repositoryId,
    resourceName: 'Repository',
    responseEvent: WebSocketResponseEvents.REPOSITORY_DELETED,
    existsCheck: () => repositoryService.exists(repositoryId),
    findPodsUsing: (canvasId: string) => podStore.findByRepositoryId(canvasId, repositoryId),
    deleteNotes: (canvasId: string) => repositoryNoteStore.deleteByForeignKey(canvasId, repositoryId),
    deleteResource: async () => {
      if (metadata?.parentRepoId) {
        const parentExists = await repositoryService.exists(metadata.parentRepoId);
        if (parentExists) {
          const parentRepoPath = repositoryService.getRepositoryPath(metadata.parentRepoId);
          const worktreePath = repositoryService.getRepositoryPath(repositoryId);

          const removeResult = await gitService.removeWorktree(parentRepoPath, worktreePath);
          if (!removeResult.success) {
            logger.log('Repository', 'Delete', `警告：移除 worktree 註冊失敗: ${removeResult.error}`);
          }

          if (metadata.branchName) {
            const deleteResult = await gitService.deleteBranch(parentRepoPath, metadata.branchName);
            if (!deleteResult.success) {
              logger.log('Repository', 'Delete', `警告：刪除分支失敗: ${deleteResult.error}`);
            }
          }
        } else {
          logger.log('Repository', 'Delete', `Parent repository ${metadata.parentRepoId} 不存在，跳過 worktree 清理`);
        }
      }

      await repositoryService.delete(repositoryId);
    },
  });
}
