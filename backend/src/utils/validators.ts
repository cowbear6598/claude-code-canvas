import { PodColor } from '../types/index.js';

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
