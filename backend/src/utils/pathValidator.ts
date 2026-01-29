import path from 'path';

/**
 * 驗證 skillId 格式
 * 僅允許字母、數字、底線、橫線
 */
export function validateSkillId(skillId: string): boolean {
  if (!skillId) {
    return false;
  }

  // 僅允許字母、數字、底線、橫線
  if (!/^[a-zA-Z0-9_-]+$/.test(skillId)) {
    return false;
  }

  // 長度限制
  return skillId.length <= 100;
}

/**
 * 驗證 podId 格式 (UUID)
 */
export function validatePodId(podId: string): boolean {
  if (!podId) {
    return false;
  }

  // UUID 格式驗證
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

/**
 * 驗證 Skill 名稱格式
 * 允許字母、數字、空格、底線、橫線
 */
export function validateSkillName(name: string): boolean {
  if (!name) {
    return false;
  }

  // 允許字母、數字、空格、底線、橫線
  return /^[a-zA-Z0-9 _-]{1,100}$/.test(name);
}

/**
 * 檢查路徑是否在指定目錄內
 */
export function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(directory);

  return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
}
