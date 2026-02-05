/**
 * 日誌分類
 */
export type LogCategory =
  | 'Startup'
  | 'Pod'
  | 'Chat'
  | 'Skill'
  | 'Command'
  | 'Repository'
  | 'SubAgent'
  | 'Workflow'
  | 'Connection'
  | 'Paste'
  | 'Note'
  | 'OutputStyle'
  | 'Git'
  | 'AutoClear'
  | 'Schedule'
  | 'Canvas'
  | 'Workspace'
  | 'WebSocket';

/**
 * 日誌動作
 */
export type LogAction =
  | 'Create'
  | 'Delete'
  | 'Update'
  | 'List'
  | 'Bind'
  | 'Unbind'
  | 'Load'
  | 'Save'
  | 'Error'
  | 'Complete'
  | 'Rename'
  | 'Switch'
  | 'Check'
  | 'Reorder';

/**
 * 清理字串中的敏感資訊（Token、密碼等）
 * @param str 要清理的字串
 * @returns 清理後的字串
 */
function sanitizeSensitiveInfo(str: string): string {
  return str
    // GitHub Token (https://token@github.com)
    .replace(/https:\/\/[^@\s]+@github\.com/g, 'https://***@github.com')
    // GitLab Token (https://oauth2:token@gitlab.com)
    .replace(/https:\/\/oauth2:[^@\s]+@[^\s/]+/g, 'https://oauth2:***@[REDACTED]')
    // 通用 HTTPS Token (https://anything@domain)
    .replace(/https:\/\/[^@\s]+@([^\s/]+)/g, 'https://***@$1')
    // GitHub Personal Access Token (ghp_xxxx)
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***')
    // GitLab Personal Access Token (glpat-xxxx)
    .replace(/glpat-[a-zA-Z0-9_-]{20}/g, 'glpat-***');
}

/**
 * 清理錯誤物件中的敏感資訊
 * @param error 錯誤物件
 * @returns 清理後的錯誤描述字串
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const sanitizedMessage = sanitizeSensitiveInfo(error.message);
    const sanitizedStack = error.stack ? sanitizeSensitiveInfo(error.stack) : '';
    return sanitizedStack || sanitizedMessage;
  }

  const errorStr = String(error);
  return sanitizeSensitiveInfo(errorStr);
}

/**
 * Logger 類別
 */
class Logger {
  /**
   * 記錄一般日誌
   * @param category 日誌分類
   * @param action 日誌動作
   * @param message 日誌訊息
   */
  log(category: LogCategory, action: LogAction, message: string): void {
    console.log(`[${category}] [${action}] ${message}`);
  }

  /**
   * 記錄錯誤日誌
   * @param category 日誌分類
   * @param action 日誌動作
   * @param message 日誌訊息
   * @param error 錯誤物件（選填）
   */
  error(category: LogCategory, action: LogAction, message: string, error?: unknown): void {
    console.error(`[${category}] [${action}] ${message}`);
    if (error) {
      const sanitizedError = sanitizeError(error);
      console.error(sanitizedError);
    }
  }
}

/**
 * Logger singleton instance
 */
export const logger = new Logger();
