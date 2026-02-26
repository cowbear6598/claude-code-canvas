import type {Message, SubMessage, ToolUseInfo} from '@/types/chat'

function markToolCompleted(tool: ToolUseInfo): ToolUseInfo {
    return {...tool, status: 'completed'}
}

/** 在最後一個 subMessage 中追加 toolUse */
export function appendToolUseToLastSub(subMessages: SubMessage[], toolUseInfo: ToolUseInfo): SubMessage[] {
    const updated = [...subMessages]
    const lastIndex = updated.length - 1
    const lastSub = updated[lastIndex]
    if (!lastSub) return updated

    const subToolUse = lastSub.toolUse || []
    const exists = subToolUse.some(t => t.toolUseId === toolUseInfo.toolUseId)

    updated[lastIndex] = {
        ...lastSub,
        toolUse: exists ? subToolUse : [...subToolUse, toolUseInfo]
    }

    return updated
}

/**
 * 更新 SubMessage 內容
 * 處理 expectingNewBlock 邏輯與 last subMessage 的 content 計算
 */
export function updateSubMessageContent(
    subMessages: SubMessage[],
    existingMessage: Message,
    delta: string,
    isPartial: boolean,
    content: string
): SubMessage[] {
    const updatedSubMessages = [...subMessages]

    if (existingMessage.expectingNewBlock) {
        const newSubMessage: SubMessage = {
            id: `${existingMessage.id}-sub-${updatedSubMessages.length}`,
            content: delta,
            isPartial
        }
        updatedSubMessages.push(newSubMessage)
    } else {
        const lastSubIndex = updatedSubMessages.length - 1
        if (lastSubIndex >= 0) {
            const sumOfPreviousContents = updatedSubMessages
                .slice(0, lastSubIndex)
                .reduce((sum, sub) => sum + sub.content.length, 0)
            const lastSubContent = content.slice(sumOfPreviousContents)

            const lastSub = updatedSubMessages[lastSubIndex]
            if (lastSub) {
                updatedSubMessages[lastSubIndex] = {
                    ...lastSub,
                    content: lastSubContent,
                    isPartial
                }
            }
        }
    }

    return updatedSubMessages
}

/**
 * 更新 SubMessages 中的 ToolUse Result
 * 處理 toolUse status 更新與 allToolsCompleted 計算
 */
export function updateSubMessagesToolUseResult(
    subMessages: SubMessage[],
    toolUseId: string,
    output: string
): SubMessage[] {
    const updatedSubMessages = [...subMessages]

    for (let i = 0; i < updatedSubMessages.length; i++) {
        const sub = updatedSubMessages[i]
        if (!sub) continue
        if (sub.toolUse) {
            const updatedSubToolUse = sub.toolUse.map(tool =>
                tool.toolUseId === toolUseId
                    ? {...markToolCompleted(tool), output}
                    : tool
            )

            const allToolsCompleted = updatedSubToolUse.every(
                tool => tool.status === 'completed' || tool.status === 'error'
            )

            updatedSubMessages[i] = {
                ...sub,
                toolUse: updatedSubToolUse,
                ...(allToolsCompleted && { isPartial: false })
            }
        }
    }

    return updatedSubMessages
}

/**
 * 將 running 狀態的 toolUse 標記為 completed
 */
export function finalizeToolUse(toolUse: ToolUseInfo[] | undefined): ToolUseInfo[] | undefined {
    if (!toolUse || toolUse.length === 0) {
        return undefined
    }

    return toolUse.map(tool =>
        tool.status === 'running' ? markToolCompleted(tool) : tool
    )
}

function finalizeToolUseInSub(sub: SubMessage): SubMessage {
    if (!sub.toolUse || sub.toolUse.length === 0) {
        return {...sub, isPartial: false}
    }

    const updatedSubToolUse = sub.toolUse.map(tool =>
        tool.status === 'running' ? markToolCompleted(tool) : tool
    )

    return {...sub, isPartial: false, toolUse: updatedSubToolUse}
}

/**
 * 將所有 subMessages 設為 isPartial: false
 * 並 finalize 每個 subMessage 中的 toolUse
 */
export function finalizeSubMessages(subMessages: SubMessage[] | undefined): SubMessage[] | undefined {
    if (!subMessages || subMessages.length === 0) {
        return undefined
    }

    return subMessages.map(sub => finalizeToolUseInSub(sub))
}

/**
 * 建立最終更新的 message 物件
 */
export function updateMainMessageState(
    message: Message,
    fullContent: string,
    updatedToolUse: ToolUseInfo[] | undefined,
    finalizedSubMessages: SubMessage[] | undefined
): Message {
    return {
        ...message,
        content: fullContent,
        isPartial: false,
        ...(updatedToolUse && {toolUse: updatedToolUse}),
        ...(finalizedSubMessages && {subMessages: finalizedSubMessages}),
        expectingNewBlock: undefined
    }
}
