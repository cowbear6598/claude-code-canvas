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

export function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);

  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}
