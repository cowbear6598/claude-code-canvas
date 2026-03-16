import type { Message } from '@/types/chat'

export function buildRunPodCacheKey(runId: string, podId: string): string {
    return `${runId}:${podId}`
}

export function buildSubMessageId(parentMessageId: string, toolUseId: string | undefined): string {
    return `${parentMessageId}-${toolUseId ?? 'no-tool'}`
}

export function applyToolUseToMessage(
    message: Message,
    payload: {
        toolUseId: string
        toolName: string
        input: Record<string, unknown>
    }
): void {
    const subMessages = message.subMessages ?? []
    subMessages.push({
        id: payload.toolUseId,
        content: '',
        toolUse: [{
            toolUseId: payload.toolUseId,
            toolName: payload.toolName,
            input: payload.input,
            status: 'running',
        }],
    })
    message.subMessages = subMessages
}

export function applyToolResultToMessage(
    message: Message,
    payload: {
        toolUseId: string
        output: string
    }
): void {
    if (!message.subMessages) return

    for (const subMessage of message.subMessages) {
        if (!subMessage.toolUse) continue
        const toolUseEntry = subMessage.toolUse.find(t => t.toolUseId === payload.toolUseId)
        if (toolUseEntry) {
            toolUseEntry.output = payload.output
            toolUseEntry.status = 'completed'
            return
        }
    }
}

export function upsertMessage(
    messages: Message[],
    messageId: string,
    content: string,
    isPartial: boolean,
    role: string
): void {
    const existingIndex = messages.findIndex(m => m.id === messageId)
    if (existingIndex !== -1) {
        const existing = messages[existingIndex]
        if (existing) {
            messages[existingIndex] = { ...existing, content, isPartial }
        }
        return
    }

    messages.push({
        id: messageId,
        role: role as 'user' | 'assistant',
        content,
        isPartial,
    })
}
