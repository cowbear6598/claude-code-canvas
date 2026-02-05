/**
 * 錯誤訊息過濾器
 * 將後端錯誤轉換為用戶友善的訊息，並移除敏感資訊
 */

const MAX_ERROR_LENGTH = 200

// 敏感資訊的正則表達式模式
const SENSITIVE_PATTERNS = [
  // 檔案路徑 (Windows & Unix)
  /[A-Za-z]:\\[\w\\.-]+/g,
  // eslint-disable-next-line no-useless-escape
  /\/[\w\/.-]+/g,
  // Email
  /[\w.-]+@[\w.-]+\.\w+/g,
  // IP 地址
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // Token 或 API Key (常見格式)
  /[a-zA-Z0-9_-]{20,}/g,
  // 堆疊追蹤關鍵字
  /at\s+[\w.]+\s+\([^)]+\)/g,
]

// 常見錯誤映射表
const ERROR_MAPPING: Record<string, string> = {
  'ECONNREFUSED': '無法連線到伺服器',
  'ENOTFOUND': '找不到伺服器',
  'ETIMEDOUT': '連線逾時',
  'ECONNRESET': '連線中斷',
  'ALREADY_EXISTS': '資源已存在',
  'NOT_FOUND': '找不到資源',
  'UNAUTHORIZED': '權限不足',
  'FORBIDDEN': '禁止存取',
  'INVALID_REQUEST': '請求格式錯誤',
  'INTERNAL_ERROR': '伺服器內部錯誤',
}

/**
 * 移除錯誤訊息中的敏感資訊
 */
function removeSensitiveInfo(message: string): string {
  let sanitized = message

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[已隱藏]')
  }

  return sanitized
}

/**
 * 將錯誤代碼映射為用戶友善訊息
 */
function mapErrorCode(message: string): string {
  for (const [code, friendlyMessage] of Object.entries(ERROR_MAPPING)) {
    if (message.includes(code)) {
      return friendlyMessage
    }
  }

  return message
}

/**
 * 限制錯誤訊息長度
 */
function limitLength(message: string, maxLength: number = MAX_ERROR_LENGTH): string {
  if (message.length <= maxLength) {
    return message
  }

  return message.substring(0, maxLength) + '...'
}

/**
 * 將未知錯誤轉換為用戶友善訊息
 *
 * @param error - 任何類型的錯誤
 * @returns 過濾後的錯誤訊息
 */
export function sanitizeErrorForUser(error: unknown): string {
  // 1. 提取原始錯誤訊息
  let message: string

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message)
  } else {
    message = '未知錯誤'
  }

  // 2. 映射錯誤代碼
  message = mapErrorCode(message)

  // 3. 移除敏感資訊
  message = removeSensitiveInfo(message)

  // 4. 限制長度
  message = limitLength(message)

  return message
}
