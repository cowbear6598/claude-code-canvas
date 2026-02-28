/**
 * 取得 Claude Code 的可執行檔路徑
 * compile 模式下 process.argv[1] 會是 /$bunfs 虛擬路徑，SDK 無法使用
 * 優先順序：環境變數 > 系統 PATH > undefined
 */
export function getClaudeCodePath(): string | undefined {
    if (process.env.CLAUDE_CODE_PATH) return process.env.CLAUDE_CODE_PATH
    try {
        return Bun.which('claude') ?? undefined
    } catch {
        return undefined
    }
}
