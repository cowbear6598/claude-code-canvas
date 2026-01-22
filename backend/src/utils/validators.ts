// Validation Utilities
// Helper functions for validating request data

import { PodTypeName, PodColor } from '../types/index.js';

/**
 * Validates a Pod name
 * Rules: non-empty, max 100 characters, no special characters
 */
export function isValidPodName(name: string): boolean {
  if (!name || typeof name !== 'string') {
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
 * Validates a Pod type
 * Must be one of the valid PodTypeName values
 */
export function isValidPodType(type: string): type is PodTypeName {
  const validTypes: PodTypeName[] = [
    'Code Assistant',
    'Chat Companion',
    'Creative Writer',
    'Data Analyst',
    'General AI',
  ];
  return validTypes.includes(type as PodTypeName);
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
  if (!url || typeof url !== 'string') {
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

/**
 * Validates a UUID v4 format
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}
