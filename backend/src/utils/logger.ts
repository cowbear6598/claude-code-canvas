// Logger utility for consistent logging across the application
// Provides categorized and action-based logging with a standardized format

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
  | 'Trigger'
  | 'Canvas';

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
  | 'Switch';

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
      console.error(error);
    }
  }
}

/**
 * Logger singleton instance
 */
export const logger = new Logger();
