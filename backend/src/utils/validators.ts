import { PodColor, Pod } from '../types';
import { Result, ok, err } from '../types';
import { repositoryService } from '../services/repositoryService.js';
import { gitService } from '../services/workspace/gitService.js';
import { podStore } from '../services/podStore.js';

export function isValidPodName(name: string): boolean {
  if (!name) {
    return false;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }

  const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
  return validPattern.test(trimmed);
}

export function isValidPodColor(color: string): color is PodColor {
  const validColors: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green'];
  return validColors.includes(color as PodColor);
}

export function isValidGitUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  const httpPattern = /^https?:\/\/.+\/.+\.git$/;
  const sshPattern = /^git@.+:.+\.git$/;
  const shorthandPattern = /^[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+$/;

  return httpPattern.test(url) || sshPattern.test(url) || shorthandPattern.test(url);
}

export async function validateRepositoryExists(repositoryId: string): Promise<Result<string>> {
  const exists = await repositoryService.exists(repositoryId);
  if (!exists) {
    return err(`找不到 Repository: ${repositoryId}`);
  }

  const repositoryPath = repositoryService.getRepositoryPath(repositoryId);
  return ok(repositoryPath);
}

export async function getValidatedGitRepository(
  repositoryId: string
): Promise<Result<{ repositoryPath: string; isGit: boolean }>> {
  const validateResult = await validateRepositoryExists(repositoryId);
  if (!validateResult.success) {
    return err(validateResult.error!);
  }

  const repositoryPath = validateResult.data!;
  const isGitResult = await gitService.isGitRepository(repositoryPath);

  if (!isGitResult.success) {
    return err(isGitResult.error!);
  }

  if (!isGitResult.data) {
    return err('不是 Git Repository');
  }

  return ok({ repositoryPath, isGit: true });
}

export function validatePodExists(canvasId: string, podId: string): Result<Pod> {
  const pod = podStore.getById(canvasId, podId);
  if (!pod) {
    return err(`找不到 Pod: ${podId}`);
  }
  return ok(pod);
}
