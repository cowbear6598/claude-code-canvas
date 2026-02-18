import { marked } from 'marked'
import DOMPurify from 'dompurify'

// marked 解析選項（每次呼叫傳入，避免全域副作用）
const MARKED_OPTIONS: marked.MarkedOptions = {
  breaks: true,
  gfm: true,
}

// 允許的 URI scheme 白名單，禁止 javascript: 和 data:
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i

// DOMPurify 安全設定 — 嚴格白名單，不依賴預設行為
const DOMPURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'del', 'code', 'pre', 'span', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'title'],
  FORCE_BODY: true,
  ALLOWED_URI_REGEXP,
}

// 為所有連結加上安全屬性，防止開啟惡意頁面
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * 將 Markdown 字串轉為安全的 HTML
 * 使用 marked 解析 + DOMPurify 消毒，防止 XSS 攻擊
 */
export function renderMarkdown(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) return ''

  const html = marked.parse(raw, MARKED_OPTIONS) as string
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG)
}
