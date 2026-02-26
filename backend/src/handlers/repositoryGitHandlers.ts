import { WebSocketResponseEvents } from '../schemas';
import type {
  RepositoryGitCloneResultPayload,
  RepositoryCheckGitResultPayload,
  RepositoryWorktreeCreatedPayload,
  RepositoryLocalBranchesResultPayload,
  RepositoryDirtyCheckResultPayload,
  RepositoryCheckoutBranchProgressPayload,
  RepositoryBranchCheckedOutPayload,
  RepositoryBranchDeletedPayload,
  RepositoryPullLatestResultPayload,
  BroadcastRepositoryBranchChangedPayload,
} from '../types';
import type {
  RepositoryGitClonePayload,
  RepositoryCheckGitPayload,
  RepositoryWorktreeCreatePayload,
  RepositoryGetLocalBranchesPayload,
  RepositoryCheckDirtyPayload,
  RepositoryCheckoutBranchPayload,
  RepositoryDeleteBranchPayload,
  RepositoryPullLatestPayload,
} from '../schemas';
import { repositoryService } from '../services/repositoryService.js';
import { socketService } from '../services/socketService.js';
import { gitService } from '../services/workspace/gitService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { validateRepositoryExists, getValidatedGitRepository } from '../utils/validators.js';
import { throttle } from '../utils/throttle.js';
import { fileExists } from '../services/shared/fileResourceHelpers.js';
import { isPathWithinDirectory } from '../utils/pathValidator.js';
import { config } from '../config';
import path from 'path';

const pullingRepositories = new Set<string>();

async function validateRepositoryIsGit(
  connectionId: string,
  repositoryId: string,
  responseEvent: WebSocketResponseEvents,
  requestId: string
): Promise<string | null> {
  const result = await getValidatedGitRepository(repositoryId);

  if (!result.success) {
    const errorCode = result.error!.includes('找不到') ? 'NOT_FOUND' : 'INVALID_STATE';
    emitError(connectionId, responseEvent, result.error!, requestId, undefined, errorCode);
    return null;
  }

  return result.data!.repositoryPath;
}

/**
 * 驗證 Git Repository URL 格式
 * @param repoUrl Repository URL
 * @returns 驗證結果
 */
function validateRepoUrl(repoUrl: string): { valid: boolean; error?: string } {
  if (repoUrl.length > 500) {
    return { valid: false, error: 'Repository URL 長度超過限制' };
  }

  const isHttpsUrl = /^https:\/\/[^\s]+$/.test(repoUrl);
  const isSshUrl = /^git@[^\s:]+:[^\s]+$/.test(repoUrl);

  if (!isHttpsUrl && !isSshUrl) {
    return { valid: false, error: 'Repository URL 格式不正確' };
  }

  return { valid: true };
}


function getStageMessage(stage: string): string {
  const stageMessages: Record<string, string> = {
    counting: '計算物件數量...',
    compressing: '壓縮物件...',
    receiving: '接收物件...',
    resolving: '解析差異...',
    writing: '寫入物件...',
  };

  return stageMessages[stage] ?? '處理中...';
}

function createProgressEmitter(
  connectionId: string,
  requestId: string,
  eventType: WebSocketResponseEvents
): (progress: number, message: string) => void {
  return (progress: number, message: string): void => {
    socketService.emitToConnection(connectionId, eventType, {
      requestId,
      progress,
      message,
    });
  };
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

export async function handleRepositoryGitClone(
  connectionId: string,
  payload: RepositoryGitClonePayload,
  requestId: string
): Promise<void> {
  const { repoUrl, branch } = payload;

  const validation = validateRepoUrl(repoUrl);
  if (!validation.valid) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      validation.error!,
      requestId,
      undefined,
      'INVALID_INPUT'
    );
    return;
  }

  const repoName = parseRepoName(repoUrl);

  const emitCloneProgress = createProgressEmitter(
    connectionId,
    requestId,
    WebSocketResponseEvents.REPOSITORY_GIT_CLONE_PROGRESS
  );

  emitCloneProgress(0, '開始 Git clone...');

  const exists = await repositoryService.exists(repoName);
  if (exists) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      `Repository 已存在: ${repoName}`,
      requestId,
      undefined,
      'ALREADY_EXISTS'
    );
    return;
  }

  await repositoryService.create(repoName);

  emitCloneProgress(5, 'Repository 已建立，開始 clone...');

  const targetPath = repositoryService.getRepositoryPath(repoName);

  const throttledEmit = throttle(emitCloneProgress, 500);

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
      connectionId,
      WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT,
      cloneResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  throttledEmit.flush();
  emitCloneProgress(95, '完成中...');

  const currentBranchResult = await gitService.getCurrentBranch(targetPath);
  if (currentBranchResult.success) {
    await repositoryService.registerMetadata(repoName, {
      currentBranch: currentBranchResult.data
    });
  }

  emitCloneProgress(100, 'Clone 完成!');

  const response: RepositoryGitCloneResultPayload = {
    requestId,
    success: true,
    repository: { id: repoName, name: repoName },
  };

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_GIT_CLONE_RESULT, response);

  logger.log('Repository', 'Create', `Successfully cloned repository: ${repoName}${branch ? ` (branch: ${branch})` : ''}`);
}

export async function handleRepositoryCheckGit(
  connectionId: string,
  payload: RepositoryCheckGitPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const validateResult = await validateRepositoryExists(repositoryId);
  if (!validateResult.success) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT,
      validateResult.error!,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const repositoryPath = validateResult.data!;
  const result = await gitService.isGitRepository(repositoryPath);

  if (!result.success) {
    emitError(
      connectionId,
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

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_CHECK_GIT_RESULT, response);
}

export async function handleRepositoryWorktreeCreate(
  connectionId: string,
  payload: RepositoryWorktreeCreatePayload,
  requestId: string
): Promise<void> {
  const { repositoryId, worktreeName } = payload;

  const validateResult = await getValidatedGitRepository(repositoryId);
  if (!validateResult.success) {
    const errorCode = validateResult.error!.includes('找不到') ? 'NOT_FOUND' : 'INVALID_STATE';
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED,
      validateResult.error!,
      requestId,
      undefined,
      errorCode
    );
    return;
  }

  const repositoryPath = validateResult.data!.repositoryPath;

  const hasCommitsResult = await gitService.hasCommits(repositoryPath);
  if (!hasCommitsResult.data) {
    emitError(
      connectionId,
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
      connectionId,
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
      connectionId,
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
      connectionId,
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
      connectionId,
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
      connectionId,
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
    canvasId: payload.canvasId,
    success: true,
    repository,
  };

  socketService.emitToCanvas(payload.canvasId, WebSocketResponseEvents.REPOSITORY_WORKTREE_CREATED, response);

  logger.log('Repository', 'Create', `Created worktree ${newRepositoryId} from ${repositoryId}`);
}

export async function handleRepositoryGetLocalBranches(
  connectionId: string,
  payload: RepositoryGetLocalBranchesPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    connectionId,
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
      connectionId,
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

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_LOCAL_BRANCHES_RESULT, response);
  logger.log('Repository', 'List', `Got local branches for ${repositoryId}`);
}

export async function handleRepositoryCheckDirty(
  connectionId: string,
  payload: RepositoryCheckDirtyPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    connectionId,
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
      connectionId,
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

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_DIRTY_CHECK_RESULT, response);
  logger.log('Repository', 'Check', `Checked dirty status for ${repositoryId}: ${dirtyResult.data}`);
}

export async function handleRepositoryCheckoutBranch(
  connectionId: string,
  payload: RepositoryCheckoutBranchPayload,
  requestId: string
): Promise<void> {
  const { repositoryId, branchName, force } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    connectionId,
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
      connectionId,
      WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT,
      'Worktree 無法切換分支',
      requestId,
      undefined,
      'INVALID_STATE'
    );
    return;
  }

  function emitCheckoutProgress(progress: number, message: string): void {
    const progressPayload: RepositoryCheckoutBranchProgressPayload = {
      requestId,
      progress,
      message,
      branchName,
    };
    socketService.emitToConnection(connectionId, WebSocketResponseEvents.REPOSITORY_CHECKOUT_BRANCH_PROGRESS, progressPayload);
  }

  const throttledEmit = throttle(emitCheckoutProgress, 500);

  emitCheckoutProgress(0, '準備切換分支...');

  const checkoutResult = await gitService.smartCheckoutBranch(repositoryPath, branchName, {
    force,
    onProgress: (progress, message) => throttledEmit(progress, message),
  });

  if (!checkoutResult.success) {
    throttledEmit.cancel();
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT,
      checkoutResult.error!,
      requestId,
      undefined,
      'INTERNAL_ERROR'
    );
    return;
  }

  throttledEmit.flush();

  const action = checkoutResult.data;
  const completionMessage = action === 'created' ? '分支建立完成' : '切換完成';
  emitCheckoutProgress(100, completionMessage);

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

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT, response);

  const broadcastPayload: BroadcastRepositoryBranchChangedPayload = {
    repositoryId,
    branchName,
  };
  socketService.emitToAllExcept(connectionId, WebSocketResponseEvents.REPOSITORY_BRANCH_CHANGED, broadcastPayload);

  logger.log('Repository', 'Update', `Checked out branch ${branchName} for ${repositoryId} (${action})`);
}

export async function handleRepositoryDeleteBranch(
  connectionId: string,
  payload: RepositoryDeleteBranchPayload,
  requestId: string
): Promise<void> {
  const { repositoryId, branchName, force } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    connectionId,
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
      connectionId,
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

  emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_BRANCH_DELETED, response);

  logger.log('Repository', 'Update', `Deleted branch ${branchName} from ${repositoryId}`);
}

export async function handleRepositoryPullLatest(
  connectionId: string,
  payload: RepositoryPullLatestPayload,
  requestId: string
): Promise<void> {
  const { repositoryId } = payload;

  const repositoryPath = await validateRepositoryIsGit(
    connectionId,
    repositoryId,
    WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
    requestId
  );
  if (!repositoryPath) {
    return;
  }

  const metadata = repositoryService.getMetadata(repositoryId);
  if (metadata?.parentRepoId) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
      'Worktree 無法執行 Pull',
      requestId,
      undefined,
      'INVALID_STATE'
    );
    return;
  }

  if (pullingRepositories.has(repositoryId)) {
    emitError(
      connectionId,
      WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
      '此 Repository 已有 Pull 操作進行中',
      requestId,
      undefined,
      'CONFLICT'
    );
    return;
  }

  pullingRepositories.add(repositoryId);

  const emitPullProgress = createProgressEmitter(
    connectionId,
    requestId,
    WebSocketResponseEvents.REPOSITORY_PULL_LATEST_PROGRESS
  );

  const throttledEmit = throttle(emitPullProgress, 500);

  emitPullProgress(0, '準備 Pull...');

  try {
    const pullResult = await gitService.pullLatest(repositoryPath, (progress, message) => throttledEmit(progress, message));
    if (!pullResult.success) {
      throttledEmit.cancel();
      emitError(
        connectionId,
        WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT,
        pullResult.error!,
        requestId,
        undefined,
        'INTERNAL_ERROR'
      );
      return;
    }

    throttledEmit.flush();
    emitPullProgress(100, 'Pull 完成');

    const response: RepositoryPullLatestResultPayload = {
      requestId,
      success: true,
      repositoryId,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.REPOSITORY_PULL_LATEST_RESULT, response);

    logger.log('Repository', 'Update', `Pulled latest for ${repositoryId}`);
  } finally {
    pullingRepositories.delete(repositoryId);
  }
}
