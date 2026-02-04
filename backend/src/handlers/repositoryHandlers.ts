import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  RepositoryListResultPayload,
  RepositoryCreatedPayload,
  PodRepositoryBoundPayload,
  PodRepositoryUnboundPayload,
  RepositoryGitCloneProgressPayload,
  RepositoryGitCloneResultPayload,
  RepositoryCheckGitResultPayload,
  RepositoryWorktreeCreatedPayload,
  RepositoryLocalBranchesResultPayload,
  RepositoryDirtyCheckResultPayload,
  RepositoryBranchCheckedOutPayload,
  RepositoryBranchDeletedPayload,
} from '../types/index.js';
import type {
  RepositoryListPayload,
  RepositoryCreatePayload,
  PodBindRepositoryPayload,
  PodUnbindRepositoryPayload,
  RepositoryDeletePayload,
  RepositoryGitClonePayload,
  RepositoryCheckGitPayload,
  RepositoryWorktreeCreatePayload,
  RepositoryGetLocalBranchesPayload,
  RepositoryCheckDirtyPayload,
  RepositoryCheckoutBranchPayload,
  RepositoryDeleteBranchPayload,
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
import { validatePod, handleResourceDelete, withCanvasId } from '../utils/handlerHelpers.js';
import { throttle } from '../utils/throttle.js';
import { fileExists } from '../services/shared/fileResourceHelpers.js';
import { isPathWithinDirectory } from '../utils/pathValidator.js';
import { config } from '../config/index.js';
import path from 'path';

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

async function validateRepositoryIsGit(
  socket: Socket,
  repositoryId: string,
  responseEvent: WebSocketResponseEvents,
  requestId: string
): Promise<string | null> {
  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(socket, responseEvent, `找不到 Repository: ${repositoryId}`, requestId, undefined, 'NOT_FOUND');
    return null;
  }

  const repositoryPath = repositoryService.getRepositoryPath(repositoryId);
  const isGitResult = await gitService.isGitRepository(repositoryPath);

  if (!isGitResult.success || !isGitResult.data) {
    emitError(socket, responseEvent, '不是 Git Repository', requestId, undefined, 'INVALID_STATE');
    return null;
  }

  return repositoryPath;
}

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

  socketService.emitToAll(WebSocketResponseEvents.REPOSITORY_CREATED, response);

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
    canvasId,
    success: true,
    pod: updatedPod,
  };

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, response);

  logger.log('Repository', 'Unbind', `Unbound repository from Pod ${podId}`);
  }
);

export async function handleRepositoryDelete(
  socket: Socket,
  payload: RepositoryDeletePayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const metadata = repositoryService.getMetadata(repositoryId);

  await handleResourceDelete({
    socket,
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

  // Clone 成功後，取得目前分支名稱並儲存
  const currentBranchResult = await gitService.getCurrentBranch(targetPath);
  if (currentBranchResult.success) {
    await repositoryService.registerMetadata(repoName, {
      currentBranch: currentBranchResult.data
    });
  }

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

/**
 * 從 Git URL 提取並正規化 Repository 名稱
 *
 * 處理兩種主要格式：
 * 1. SSH: git@github.com:user/repo.git → user/repo
 * 2. HTTPS: https://github.com/user/repo.git → repo
 *
 * 轉換步驟：
 * 1. SSH 格式從冒號後取路徑，HTTPS 格式移除協議前綴後取最後一段
 * 2. 移除 .git 副檔名避免重複
 * 3. 將非法字元（斜線等）替換為連字號，確保可作為資料夾名稱
 */
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

export async function handleRepositoryCheckGit(
  socket: Socket,
  payload: RepositoryCheckGitPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
      `找不到 Repository: ${repositoryId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const repositoryPath = repositoryService.getRepositoryPath(repositoryId);
  const result = await gitService.isGitRepository(repositoryPath);

  if (!result.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
      result.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: RepositoryCheckGitResultPayload = {
    requestId,
    success: true,
    isGit: result.data,
  };

  logger.log('Repository', 'Check', `${repositoryId} isGit: ${result.data}`);

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT, response);
}

export async function handleRepositoryWorktreeCreate(
  socket: Socket,
  payload: RepositoryWorktreeCreatePayload,
  requestId: string
): Promise<void> {
  const { repositoryId, worktreeName } = payload;

  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      `找不到 Repository: ${repositoryId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const repositoryPath = repositoryService.getRepositoryPath(repositoryId);
  const isGitResult = await gitService.isGitRepository(repositoryPath);

  if (!isGitResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      isGitResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  if (!isGitResult.data) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      `${repositoryId} 不是 Git Repository`,
      requestId,
      undefined,
      'INVALID_STATE'
    );
    return;
  }

  const hasCommitsResult = await gitService.hasCommits(repositoryPath);
  if (!hasCommitsResult.data) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      'Repository 沒有任何 commit，無法建立 Worktree',
      requestId,
      undefined,
      'INVALID_STATE'
    );
    return;
  }

  const parentDirectory = repositoryService.getParentDirectory();
  const newRepositoryId = `${repositoryId}-${worktreeName}`;
  const targetPath = path.join(parentDirectory, newRepositoryId);

  if (!isPathWithinDirectory(targetPath, config.repositoriesRoot)) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      '無效的 worktree 路徑',
      requestId,
      undefined,
      'INVALID_PATH'
    );
    return;
  }

  const targetExists = await fileExists(targetPath);
  if (targetExists) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      `資料夾已存在: ${newRepositoryId}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );
    return;
  }

  const branchExistsResult = await gitService.branchExists(repositoryPath, worktreeName);
  if (!branchExistsResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      branchExistsResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  if (branchExistsResult.data) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      `分支已存在: ${worktreeName}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );
    return;
  }

  const createResult = await gitService.createWorktree(repositoryPath, targetPath, worktreeName);
  if (!createResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      `建立 Worktree 失敗: ${createResult.error}`,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  await repositoryService.registerMetadata(newRepositoryId, {
    parentRepoId: repositoryId,
    branchName: worktreeName
  });

  const repository = {
    id: newRepositoryId,
    name: newRepositoryId,
    parentRepoId: repositoryId,
    branchName: worktreeName
  };

  const response: RepositoryWorktreeCreatedPayload = {
    requestId,
    success: true,
    repository,
  };

  socketService.emitToAll(WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED, response);

  logger.log('Repository', 'Create', `Created worktree ${newRepositoryId} from ${repositoryId}`);
}

export async function handleRepositoryGetLocalBranches(
  socket: Socket,
  payload: RepositoryGetLocalBranchesPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    socket,
    repositoryId,
    WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
    requestId
  );
  if (!repositoryPath) {
    return;
  }

  const branchesResult = await gitService.getLocalBranches(repositoryPath);
  if (!branchesResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT,
      branchesResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: RepositoryLocalBranchesResultPayload = {
    requestId,
    success: true,
    branches: branchesResult.data!.branches,
    currentBranch: branchesResult.data!.current,
    worktreeBranches: branchesResult.data!.worktreeBranches,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT, response);
  logger.log('Repository', 'List', `Got local branches for ${repositoryId}`);
}

export async function handleRepositoryCheckDirty(
  socket: Socket,
  payload: RepositoryCheckDirtyPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    socket,
    repositoryId,
    WebSocketResponseEvents.REPOSITORY_DIRTY_CHECK_RESULT,
    requestId
  );
  if (!repositoryPath) {
    return;
  }

  const dirtyResult = await gitService.hasUncommittedChanges(repositoryPath);
  if (!dirtyResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_DIRTY_CHECK_RESULT,
      dirtyResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: RepositoryDirtyCheckResultPayload = {
    requestId,
    success: true,
    isDirty: dirtyResult.data,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_DIRTY_CHECK_RESULT, response);
  logger.log('Repository', 'Check', `Checked dirty status for ${repositoryId}: ${dirtyResult.data}`);
}

export async function handleRepositoryCheckoutBranch(
  socket: Socket,
  payload: RepositoryCheckoutBranchPayload,
  requestId: string
): Promise<void> {
  const { repositoryId, branchName, force } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    socket,
    repositoryId,
    WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT,
    requestId
  );
  if (!repositoryPath) {
    return;
  }

  const metadata = repositoryService.getMetadata(repositoryId);
  if (metadata?.parentRepoId) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT,
      'Worktree 無法切換分支',
      requestId,
      undefined,
      'INVALID_STATE'
    );
    return;
  }

  const checkoutResult = await gitService.smartCheckoutBranch(repositoryPath, branchName, force);
  if (!checkoutResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT,
      checkoutResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const action = checkoutResult.data;

  await repositoryService.registerMetadata(repositoryId, {
    ...metadata,
    currentBranch: branchName
  });

  const response: RepositoryBranchCheckedOutPayload = {
    requestId,
    success: true,
    repositoryId,
    branchName,
    action,
  };

  socketService.emitToAll(WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT, response);

  logger.log('Repository', 'Update', `Checked out branch ${branchName} for ${repositoryId} (${action})`);
}

export async function handleRepositoryDeleteBranch(
  socket: Socket,
  payload: RepositoryDeleteBranchPayload,
  requestId: string
): Promise<void> {
  const { repositoryId, branchName, force } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    socket,
    repositoryId,
    WebSocketResponseEvents.REPOSITORY_BRANCH_DELETED,
    requestId
  );
  if (!repositoryPath) {
    return;
  }

  const deleteResult = await gitService.deleteBranch(repositoryPath, branchName, force);
  if (!deleteResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.REPOSITORY_BRANCH_DELETED,
      deleteResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  const response: RepositoryBranchDeletedPayload = {
    requestId,
    success: true,
    branchName,
  };

  emitSuccess(socket, WebSocketResponseEvents.REPOSITORY_BRANCH_DELETED, response);

  logger.log('Repository', 'Update', `Deleted branch ${branchName} from ${repositoryId}`);
}
