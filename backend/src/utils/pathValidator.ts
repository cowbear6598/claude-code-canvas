import path from 'path';

export function validateSkillId(skillId: string): boolean {
  if (!skillId) {
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    return false;
  }

  return skillId.length <= 100;
}

export function validatePodId(podId: string): boolean {
  if (!podId) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(podId);
}

function validateIdFormat(id: string): boolean {
  if (!id) {
    return false;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return false;
  }

  return id.length <= 100;
}

export function validateSubAgentId(subAgentId: string): boolean {
  return validateIdFormat(subAgentId);
}

export function validateCommandId(commandId: string): boolean {
  return validateIdFormat(commandId);
}

export function validateOutputStyleId(outputStyleId: string): boolean {
  return validateIdFormat(outputStyleId);
}

export function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);

  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}

export function validatePathSegment(segment: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(segment) && segment.length <= 100;
}

export function validateGroupName(name: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(name) && name.length > 0 && name.length <= 100;
}

export function sanitizePathSegment(segment: string): string {
  const sanitized = path.basename(segment);
  if (!validatePathSegment(sanitized)) {
    throw new Error('名稱格式不正確，只能包含英文、數字、dash');
  }
  return sanitized;
}
