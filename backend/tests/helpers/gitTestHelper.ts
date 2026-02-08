import * as fs from 'fs/promises';
import { $ } from 'bun';

/**
 * 初始化 Git repository
 * - 執行 git init
 * - 設定 user.email 和 user.name
 * - 建立 README.md 並提交
 */
export async function initGitRepo(repoPath: string): Promise<string> {
  await $`git init ${repoPath}`.quiet();
  await $`git -C ${repoPath} config user.email "test@example.com"`.quiet();
  await $`git -C ${repoPath} config user.name "Test User"`.quiet();
  await $`echo "test" > ${repoPath}/README.md`.quiet();
  await $`git -C ${repoPath} add .`.quiet();
  await $`git -C ${repoPath} commit -m "Initial commit"`.quiet();

  return repoPath;
}

/**
 * 初始化 Git repository 並設定 remote
 * - 建立 bare remote repo
 * - 初始化本地 repo
 * - 設定 remote origin 並 push
 */
export async function initGitRepoWithRemote(
  repoPath: string,
  remoteRepoPath: string
): Promise<string> {
  await $`git init --bare ${remoteRepoPath}`.quiet();

  await initGitRepo(repoPath);

  await $`git -C ${repoPath} remote add origin ${remoteRepoPath}`.quiet();
  await $`git -C ${repoPath} push -u origin main || git -C ${repoPath} push -u origin master`.quiet();

  return repoPath;
}

/**
 * 清理 repository 目錄
 * - 使用 fs.rm recursive 清理
 * - 忽略錯誤
 */
export async function cleanupRepo(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch {
    // 忽略清理錯誤
  }
}
