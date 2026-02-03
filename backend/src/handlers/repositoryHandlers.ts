import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  RepositoryListResultPayload,
  RepositoryCreatedPayload,
  PodRepositoryBoundPayload,
  PodRepositoryUnboundPayload,
  RepositoryGitCloneProgressPayload,
  RepositoryGitCloneResultPayload,
  BroadcastRepositoryCreatedPayload,
  BroadcastPodRepositoryBoundPayload,
  BroadcastPodRepositoryUnboundPayload,
} from '../types/index.js';
import type {
  RepositoryListPayload,
  RepositoryCreatePayload,
  PodBindRepositoryPayload,
  PodUnbindRepositoryPayload,
  RepositoryDeletePayload,
  RepositoryGitClonePayload,
} from '../schemas/index.js';
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
import { validatePod, handleResourceDelete, getCanvasId, withCanvasId } from '../utils/handlerHelpers.js';
import { throttle } from '../utils/throttle.js';

const repositoryNoteHandlers = createNoteHandlers({
  noteStore: repositoryNoteStore,
  events: {
    created: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED,
    listResult: WebSocketResponseEvents.REPOSITORY_NOTE_LIST_RESULT,
    updated: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED,
    deleted: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED,
  },
  broadcastEvents: {
    created: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_CREATED,
    updated: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_UPDATED,
    deleted: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_DELETED,
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
  socket: Socket,
  _: RepositoryListPayload,
  requestId: string
): Promise<void> {
  const repositories = await repositoryService.list();

  const response: RepositoryListResultPayload = {
    requestId,
    success: true,
    repositories,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_LIST_RESULT, response);
}

export async function handleRepositoryCreate(
  socket: Socket,
  payload: RepositoryCreatePayload,
  requestId: string
): Promise<void> {
  const { name } = payload;

  const exists = await repositoryService.exists(name);
  if (exists) {
    emitError(
      socket,
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

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_CREATED, response);

  const canvasId = getCanvasId(socket, WebSocketResponseEvents.REPOSITORY_CREATED, requestId);
  if (canvasId) {
    const broadcastPayload: BroadcastRepositoryCreatedPayload = {
      canvasId,
      repository,
    };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_REPOSITORY_CREATED, broadcastPayload);
  }

  logger.log('Repository', 'Create', `Created repository ${repository.id}`);
}

export const handlePodBindRepository = withCanvasId<PodBindRepositoryPayload>(
  WebSocketResponseEvents.POD_REPOSITORY_BOUND,
  async (socket: Socket, canvasId: string, payload: PodBindRepositoryPayload, requestId: string): Promise<void> => {
    const { podId, repositoryId } = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_REPOSITORY_BOUND, requestId);
    if (!pod) {
      return;
    }

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_REPOSITORY_BOUND,
      `找不到 Repository: ${repositoryId}`,
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
    try {
      await commandService.deleteCommandFromPath(podWorkspacePath);
    } catch (error) {
      logger.error('Repository', 'Bind', `Failed to delete commands from Pod ${podId} workspace`, error);
    }
    try {
      await skillService.deleteSkillsFromPath(podWorkspacePath);
    } catch (error) {
      logger.error('Repository', 'Bind', `Failed to delete skills from Pod ${podId} workspace`, error);
    }
    try {
      await subAgentService.deleteSubAgentsFromPath(podWorkspacePath);
    } catch (error) {
      logger.error('Repository', 'Bind', `Failed to delete subagents from Pod ${podId} workspace`, error);
    }
  }

  await clearPodMessages(socket, podId);

  const updatedPod = podStore.getById(canvasId, podId);

  const response: PodRepositoryBoundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_BOUND, response);

  const broadcastPayload: BroadcastPodRepositoryBoundPayload = {
    canvasId,
    pod: updatedPod!,
  };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_BOUND, broadcastPayload);

    logger.log('Repository', 'Bind', `Bound repository ${repositoryId} to Pod ${podId}`);
  }
);

export const handlePodUnbindRepository = withCanvasId<PodUnbindRepositoryPayload>(
  WebSocketResponseEvents.POD_REPOSITORY_UNBOUND,
  async (socket: Socket, canvasId: string, payload: PodUnbindRepositoryPayload, requestId: string): Promise<void> => {
    const { podId } = payload;

    const pod = validatePod(socket, podId, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, requestId);
    if (!pod) {
      return;
    }

  const oldRepositoryId = pod.repositoryId;

  podStore.setRepositoryId(canvasId, podId, null);
  podStore.setClaudeSessionId(canvasId, podId, '');

  if (oldRepositoryId) {
    await repositorySyncService.syncRepositoryResources(oldRepositoryId);
  }

  for (const skillId of pod.skillIds) {
    try {
      await skillService.copySkillToPod(skillId, podId, pod.workspacePath);
    } catch (error) {
      logger.error('Repository', 'Unbind', `Failed to copy skill ${skillId} to Pod ${podId}`, error);
    }
  }

  for (const subAgentId of pod.subAgentIds) {
    try {
      await subAgentService.copySubAgentToPod(subAgentId, podId, pod.workspacePath);
    } catch (error) {
      logger.error('Repository', 'Unbind', `Failed to copy subagent ${subAgentId} to Pod ${podId}`, error);
    }
  }

  if (pod.commandId) {
    try {
      await commandService.copyCommandToPod(pod.commandId, podId, pod.workspacePath);
    } catch (error) {
      logger.error('Repository', 'Unbind', `Failed to copy command ${pod.commandId} to Pod ${podId}`, error);
    }
  }

  await clearPodMessages(socket, podId);

  const updatedPod = podStore.getById(canvasId, podId);

  const response: PodRepositoryUnboundPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, response);

  const broadcastPayload: BroadcastPodRepositoryUnboundPayload = {
    canvasId,
    pod: updatedPod!,
  };
    socketService.broadcastToCanvas(socket.id, canvasId, WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_UNBOUND, broadcastPayload);

    logger.log('Repository', 'Unbind', `Unbound repository from Pod ${podId}`);
  }
);

export async function handleRepositoryDelete(
  socket: Socket,
  payload: RepositoryDeletePayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  await handleResourceDelete({
    socket,
    requestId,
    resourceId: repositoryId,
    resourceName: 'Repository',
    responseEvent: WebSocketResponseEvents.REPOSITORY_DELETED,
    broadcastEvent: WebSocketResponseEvents.BROADCAST_REPOSITORY_DELETED,
    existsCheck: () => repositoryService.exists(repositoryId),
    findPodsUsing: (canvasId: string) => podStore.findByRepositoryId(canvasId, repositoryId),
    deleteNotes: (canvasId: string) => repositoryNoteStore.deleteByForeignKey(canvasId, repositoryId),
    deleteResource: () => repositoryService.delete(repositoryId),
  });
}

export async function handleRepositoryGitClone(
  socket: Socket,
  payload: RepositoryGitClonePayload,
  requestId: string
): Promise<void> {
  const { repoUrl, branch } = payload;

  const repoName = parseRepoName(repoUrl);

  emitCloneProgress(socket, requestId, 0, '開始 Git clone...');

  const exists = await repositoryService.exists(repoName);
  if (exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      `Repository 已存在: ${repoName}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );
    return;
  }

  await repositoryService.create(repoName);

  emitCloneProgress(socket, requestId, 5, 'Repository 已建立，開始 clone...');

  const targetPath = repositoryService.getRepositoryPath(repoName);

  const throttledEmit = throttle((progress: number, message: string) => {
    emitCloneProgress(socket, requestId, progress, message);
  }, 500);

  const cloneResult = await gitService.clone(repoUrl, targetPath, {
    branch,
    onProgress: (progressData) => {
      const mappedProgress = Math.floor(10 + (progressData.progress * 0.8));
      const stageMessage = getStageMessage(progressData.stage);
      throttledEmit(mappedProgress, stageMessage);
    },
  });

  if (!cloneResult.success) {
    throttledEmit.cancel();
    await repositoryService.delete(repoName);
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      cloneResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  throttledEmit.flush();
  emitCloneProgress(socket, requestId, 95, '完成中...');
  emitCloneProgress(socket, requestId, 100, 'Clone 完成!');

  const response: RepositoryGitCloneResultPayload = {
    requestId,
    success: true,
    repository: { id: repoName, name: repoName },
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT, response);

  logger.log('Repository', 'Create', `Successfully cloned ${repoUrl} to repository ${repoName}${branch ? ` (branch: ${branch})` : ''}`);
}

function emitCloneProgress(socket: Socket, requestId: string, progress: number, message: string): void {
  const payload: RepositoryGitCloneProgressPayload = {
    requestId,
    progress,
    message,
  };
  socket.emit(WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS, payload);
}

function getStageMessage(stage: string): string {
  const stageMessages: Record<string, string> = {
    counting: '計算物件數量...',
    compressing: '壓縮物件...',
    receiving: '接收物件...',
    resolving: '解析差異...',
    writing: '寫入物件...',
  };

  return stageMessages[stage] || `處理中: ${stage}...`;
}

function parseRepoName(repoUrl: string): string {
  let urlPath: string;

  if (repoUrl.startsWith('git@')) {
    urlPath = repoUrl.split(':')[1] || '';
  } else {
    urlPath = repoUrl.replace(/^https?:\/\//, '').replace(/^git:\/\//, '');
    const parts = urlPath.split('/');
    urlPath = parts[parts.length - 1] || '';
  }

  let repoName = urlPath.replace(/\.git$/, '');

  if (!repoName.match(/^[a-zA-Z0-9_-]+$/)) {
    repoName = repoName.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  return repoName;
}
