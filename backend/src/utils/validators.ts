import { PodColor } from '../types/index.js';

/**
 * Validates a Pod name
 * Rules: non-empty, max 100 characters, no special characters
 */
export function isValidPodName(name: string): boolean {
  if (!name) {
    return false;
  }

  // Trim whitespace and check length
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return false;
  }

  // Allow alphanumeric, spaces, hyphens, underscores
  const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
  return validPattern.test(trimmed);
}

/**
 * Validates a Pod color
 * Must be one of the valid PodColor values
 */
export function isValidPodColor(color: string): color is PodColor {
  const validColors: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green'];
  return validColors.includes(color as PodColor);
}

/**
 * Validates a Git URL
 * Supports HTTP(S) and SSH formats
 */
export function isValidGitUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  // HTTP(S) format: https://github.com/user/repo.git
  const httpPattern = /^https?:\/\/.+\/.+\.git$/;

  // SSH format: git@github.com:user/repo.git
  const sshPattern = /^git@.+:.+\.git$/;

  // GitHub shorthand: user/repo (also support this)
  const shorthandPattern = /^[a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+$/;

  return httpPattern.test(url) || sshPattern.test(url) || shorthandPattern.test(url);
}
