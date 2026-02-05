import {generateRequestId} from '@/services/utils'
import type {Message, ToolUseInfo, ToolUseStatus} from '@/types/chat'
import type {
    PodChatMessagePayload,
    PodChatToolUsePayload,
    PodChatToolResultPayload,
    PodChatCompletePayload,
    PersistedMessage,
    PodMessagesClearedPayload,
    WorkflowAutoClearedPayload
} from '@/types/websocket'
import {RESPONSE_PREVIEW_LENGTH, CONTENT_PREVIEW_LENGTH} from '@/lib/constants'
import {truncateContent} from './chatUtils'
import type {ChatStoreInstance} from './chatStore'

export function createMessageActions(store: ChatStoreInstance): {
    addUserMessage: (podId: string, content: string) => Promise<void>
    handleChatMessage: (payload: PodChatMessagePayload) => void
    addNewChatMessage: (podId: string, messageId: string, content: string, isPartial: boolean, role?: 'user' | 'assistant', delta?: string) => void
    updateExistingChatMessage: (podId: string, messages: Message[], messageIndex: number, content: string, isPartial: boolean, delta: string) => void
    handleChatToolUse: (payload: PodChatToolUsePayload) => void
    createMessageWithToolUse: (podId: string, messageId: string, toolUseId: string, toolName: string, input: Record<string, unknown>) => void
    addToolUseToMessage: (podId: string, messages: Message[], messageIndex: number, toolUseId: string, toolName: string, input: Record<string, unknown>) => void
    handleChatToolResult: (payload: PodChatToolResultPayload) => void
    updateToolUseResult: (podId: string, messages: Message[], messageIndex: number, toolUseId: string, output: string) => void
    handleChatComplete: (payload: PodChatCompletePayload) => void
    finalizeStreaming: (podId: string, messageId: string) => void
    completeMessage: (podId: string, messages: Message[], messageIndex: number, fullContent: string, messageId: string) => void
    updatePodOutput: (podId: string) => Promise<void>
    convertPersistedToMessage: (persistedMessage: PersistedMessage) => Message
    setPodMessages: (podId: string, messages: Message[]) => void
    setTyping: (podId: string, isTyping: boolean) => void
    clearMessagesByPodIds: (podIds: string[]) => void
    handleMessagesClearedEvent: (payload: PodMessagesClearedPayload) => Promise<void>
    handleWorkflowAutoCleared: (payload: WorkflowAutoClearedPayload) => Promise<void>
} {
    const addUserMessage = async (podId: string, content: string): Promise<void> => {
        const userMessage: Message = {
            id: generateRequestId(),
            role: 'user',
            content,
            timestamp: new Date().toISOString()
        }

        const messages = store.messagesByPodId.get(podId) || []
        store.messagesByPodId.set(podId, [...messages, userMessage])

        const {usePodStore} = await import('../pod/podStore')
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (!pod) return

        const truncatedContent = `> ${truncateContent(content, CONTENT_PREVIEW_LENGTH)}`
        podStore.updatePod({
            ...pod,
            output: [...pod.output, truncatedContent]
        })
    }

    const handleChatMessage = (payload: PodChatMessagePayload): void => {
        const {podId, messageId, content, isPartial, role} = payload
        const messages = store.messagesByPodId.get(podId) || []
        const messageIndex = messages.findIndex(m => m.id === messageId)

        const lastLength = store.accumulatedLengthByMessageId.get(messageId) || 0
        const delta = content.slice(lastLength)
        store.accumulatedLengthByMessageId.set(messageId, content.length)

        if (messageIndex === -1) {
            addNewChatMessage(podId, messageId, content, isPartial, role, delta)
            return
        }

        updateExistingChatMessage(podId, messages, messageIndex, content, isPartial, delta)
    }

    const addNewChatMessage = (podId: string, messageId: string, content: string, isPartial: boolean, role?: 'user' | 'assistant', delta?: string): void => {
        const messages = store.messagesByPodId.get(podId) || []

        const newMessage: Message = {
            id: messageId,
            role: role || 'assistant',
            content,
            isPartial,
            timestamp: new Date().toISOString()
        }

        if ((role || 'assistant') === 'assistant') {
            const firstSubMessage: import('@/types/chat').SubMessage = {
                id: `${messageId}-sub-0`,
                content: delta || content,
                isPartial
            }
            newMessage.subMessages = [firstSubMessage]
            newMessage.expectingNewBlock = true
        }

        store.messagesByPodId.set(podId, [...messages, newMessage])
        store.currentStreamingMessageId = messageId

        if (isPartial) {
            setTyping(podId, true)
        }
    }

    const updateExistingChatMessage = (podId: string, messages: Message[], messageIndex: number, content: string, isPartial: boolean, delta: string): void => {
        const updatedMessages = [...messages]
        const existingMessage = updatedMessages[messageIndex]

        if (!existingMessage) return

        updatedMessages[messageIndex] = {
            ...existingMessage,
            content,
            isPartial
        }

        if (existingMessage.role === 'assistant' && existingMessage.subMessages) {
            const subMessages = [...existingMessage.subMessages]

            if (existingMessage.expectingNewBlock) {
                const newSubMessage: import('@/types/chat').SubMessage = {
                    id: `${existingMessage.id}-sub-${subMessages.length}`,
                    content: delta,
                    isPartial
                }
                subMessages.push(newSubMessage)
                updatedMessages[messageIndex].expectingNewBlock = false
            } else {
                const lastSubIndex = subMessages.length - 1
                if (lastSubIndex >= 0) {
                    const sumOfPreviousContents = subMessages.slice(0, lastSubIndex).reduce((sum, sub) => sum + sub.content.length, 0)
                    const lastSubContent = content.slice(sumOfPreviousContents)

                    const lastSub = subMessages[lastSubIndex]
                    if (lastSub) {
                        subMessages[lastSubIndex] = {
                            ...lastSub,
                            content: lastSubContent,
                            isPartial
                        }
                    }
                }
            }

            updatedMessages[messageIndex].subMessages = subMessages
        }

        store.messagesByPodId.set(podId, updatedMessages)

        if (isPartial) {
            setTyping(podId, true)
        }
    }

    const handleChatToolUse = (payload: PodChatToolUsePayload): void => {
        const {podId, messageId, toolUseId, toolName, input} = payload
        const messages = store.messagesByPodId.get(podId) || []
        const messageIndex = messages.findIndex(m => m.id === messageId)

        if (messageIndex === -1) {
            createMessageWithToolUse(podId, messageId, toolUseId, toolName, input)
            return
        }

        const existingMessage = messages[messageIndex]
        if (!existingMessage) return

        const toolAlreadyExists = existingMessage.toolUse?.some(t => t.toolUseId === toolUseId)
        if (toolAlreadyExists) return

        addToolUseToMessage(podId, messages, messageIndex, toolUseId, toolName, input)
    }

    const createMessageWithToolUse = (podId: string, messageId: string, toolUseId: string, toolName: string, input: Record<string, unknown>): void => {
        const messages = store.messagesByPodId.get(podId) || []

        const existingMessage = messages.find(m => m.id === messageId)
        if (existingMessage?.toolUse?.some(t => t.toolUseId === toolUseId)) return

        const toolUseInfo: ToolUseInfo = {
            toolUseId,
            toolName,
            input,
            status: 'running' as ToolUseStatus
        }

        const newMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: '',
            isPartial: true,
            timestamp: new Date().toISOString(),
            toolUse: [toolUseInfo],
            subMessages: [{
                id: `${messageId}-sub-0`,
                content: '',
                isPartial: true,
                toolUse: [toolUseInfo]
            }],
            expectingNewBlock: true
        }

        store.messagesByPodId.set(podId, [...messages, newMessage])
        store.currentStreamingMessageId = messageId
    }

    const addToolUseToMessage = (podId: string, messages: Message[], messageIndex: number, toolUseId: string, toolName: string, input: Record<string, unknown>): void => {
        const updatedMessages = [...messages]
        const message = updatedMessages[messageIndex]

        if (!message) return

        const toolUse = message.toolUse || []
        const toolIndex = toolUse.findIndex(t => t.toolUseId === toolUseId)
        const toolUseInfo: ToolUseInfo = {
            toolUseId,
            toolName,
            input,
            status: 'running' as ToolUseStatus
        }

        const updatedToolUse = toolIndex === -1
            ? [...toolUse, toolUseInfo]
            : toolUse

        updatedMessages[messageIndex] = {
            ...message,
            toolUse: updatedToolUse,
            expectingNewBlock: true
        }

        if (message.subMessages && message.subMessages.length > 0) {
            const subMessages = [...message.subMessages]
            const lastSubIndex = subMessages.length - 1
            const lastSub = subMessages[lastSubIndex]
            if (!lastSub) return

            const subToolUse = lastSub.toolUse || []
            const subToolIndex = subToolUse.findIndex(t => t.toolUseId === toolUseId)

            const updatedSubToolUse = subToolIndex === -1
                ? [...subToolUse, toolUseInfo]
                : subToolUse

            subMessages[lastSubIndex] = {
                ...lastSub,
                toolUse: updatedSubToolUse
            }

            updatedMessages[messageIndex].subMessages = subMessages
        }

        store.messagesByPodId.set(podId, updatedMessages)
    }

    const handleChatToolResult = (payload: PodChatToolResultPayload): void => {
        const {podId, messageId, toolUseId, output} = payload
        const messages = store.messagesByPodId.get(podId) || []
        const messageIndex = messages.findIndex(m => m.id === messageId)

        if (messageIndex === -1) return

        const message = messages[messageIndex]
        if (!message?.toolUse) return

        updateToolUseResult(podId, messages, messageIndex, toolUseId, output)
    }

    const updateToolUseResult = (podId: string, messages: Message[], messageIndex: number, toolUseId: string, output: string): void => {
        const updatedMessages = [...messages]
        const message = updatedMessages[messageIndex]

        if (!message?.toolUse) return

        const updatedToolUse = message.toolUse.map(tool =>
            tool.toolUseId === toolUseId
                ? {...tool, output, status: 'completed' as ToolUseStatus}
                : tool
        )

        updatedMessages[messageIndex] = {
            ...message,
            toolUse: updatedToolUse
        }

        if (message.subMessages) {
            const subMessages = [...message.subMessages]

            for (let i = 0; i < subMessages.length; i++) {
                const sub = subMessages[i]
                if (!sub) continue
                if (sub.toolUse) {
                    const updatedSubToolUse = sub.toolUse.map(tool =>
                        tool.toolUseId === toolUseId
                            ? {...tool, output, status: 'completed' as ToolUseStatus}
                            : tool
                    )

                    // 檢查該 subMessage 中的所有 Tool 是否都已完成
                    const allToolsCompleted = updatedSubToolUse.every(
                        tool => tool.status === 'completed' || tool.status === 'error'
                    )

                    subMessages[i] = {
                        ...sub,
                        toolUse: updatedSubToolUse,
                        // 如果所有 Tool 都完成了，將 isPartial 設為 false
                        ...(allToolsCompleted && { isPartial: false })
                    }
                }
            }

            updatedMessages[messageIndex].subMessages = subMessages
        }

        store.messagesByPodId.set(podId, updatedMessages)
    }

    const handleChatComplete = (payload: PodChatCompletePayload): void => {
        const {podId, messageId, fullContent} = payload
        const messages = store.messagesByPodId.get(podId) || []
        const messageIndex = messages.findIndex(m => m.id === messageId)

        store.accumulatedLengthByMessageId.delete(messageId)

        if (messageIndex === -1) {
            finalizeStreaming(podId, messageId)
            return
        }

        completeMessage(podId, messages, messageIndex, fullContent, messageId)
    }

    const finalizeStreaming = (podId: string, messageId: string): void => {
        setTyping(podId, false)

        if (store.currentStreamingMessageId === messageId) {
            store.currentStreamingMessageId = null
        }
    }

    const completeMessage = (podId: string, messages: Message[], messageIndex: number, fullContent: string, messageId: string): void => {
        const updatedMessages = [...messages]
        const existingMessage = updatedMessages[messageIndex]

        if (!existingMessage) return

        const hasToolUse = existingMessage.toolUse && existingMessage.toolUse.length > 0

        const updatedToolUse = hasToolUse
            ? existingMessage.toolUse!.map(tool =>
                tool.status === 'running'
                    ? {...tool, status: 'completed' as ToolUseStatus}
                    : tool
            )
            : undefined

        updatedMessages[messageIndex] = {
            ...existingMessage,
            content: fullContent,
            isPartial: false,
            ...(updatedToolUse && {toolUse: updatedToolUse})
        }

        if (existingMessage.subMessages && existingMessage.subMessages.length > 0) {
            const subMessages = [...existingMessage.subMessages]

            for (let i = 0; i < subMessages.length; i++) {
                const sub = subMessages[i]
                if (!sub) continue

                if (sub.toolUse && sub.toolUse.length > 0) {
                    const updatedSubToolUse = sub.toolUse.map(tool =>
                        tool.status === 'running'
                            ? {...tool, status: 'completed' as ToolUseStatus}
                            : tool
                    )
                    subMessages[i] = {
                        ...sub,
                        isPartial: false,
                        toolUse: updatedSubToolUse
                    }
                } else {
                    subMessages[i] = {
                        ...sub,
                        isPartial: false
                    }
                }
            }

            updatedMessages[messageIndex].subMessages = subMessages
        }

        updatedMessages[messageIndex].expectingNewBlock = undefined

        store.messagesByPodId.set(podId, updatedMessages)

        if (existingMessage.role === 'assistant') {
            updatePodOutput(podId)
        }

        finalizeStreaming(podId, messageId)
    }

    const updatePodOutput = async (podId: string): Promise<void> => {
        const {usePodStore} = await import('../pod/podStore')
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (!pod) return

        const messages = store.messagesByPodId.get(podId) || []
        const outputLines: string[] = []

        for (const msg of messages) {
            if (msg.role === 'user') {
                const userContent = msg.content
                outputLines.push(`> ${truncateContent(userContent, RESPONSE_PREVIEW_LENGTH)}`)
            } else if (msg.role === 'assistant') {
                if (msg.subMessages && msg.subMessages.length > 0) {
                    for (const sub of msg.subMessages) {
                        if (sub.content) {
                            outputLines.push(truncateContent(sub.content, RESPONSE_PREVIEW_LENGTH))
                        }
                    }
                }
            }
        }

        podStore.updatePod({
            ...pod,
            output: outputLines
        })
    }

    const convertPersistedToMessage = (persistedMessage: PersistedMessage): Message => {
        const message: Message = {
            id: persistedMessage.id,
            role: persistedMessage.role,
            content: persistedMessage.content,
            timestamp: persistedMessage.timestamp,
            isPartial: false
        }

        if (persistedMessage.role === 'assistant') {
            if (persistedMessage.subMessages && persistedMessage.subMessages.length > 0) {
                message.subMessages = persistedMessage.subMessages.map(sub => ({
                    id: sub.id,
                    content: sub.content,
                    isPartial: false,
                    toolUse: sub.toolUse?.map(tool => ({
                        toolUseId: tool.toolUseId,
                        toolName: tool.toolName,
                        input: tool.input,
                        output: tool.output,
                        status: (tool.status as ToolUseStatus) || 'completed',
                    })),
                }))

                const allToolUse: ToolUseInfo[] = []
                for (const sub of message.subMessages) {
                    if (sub.toolUse) {
                        allToolUse.push(...sub.toolUse)
                    }
                }
                if (allToolUse.length > 0) {
                    message.toolUse = allToolUse
                }
            } else {
                message.subMessages = [{
                    id: `${persistedMessage.id}-sub-0`,
                    content: persistedMessage.content,
                    isPartial: false
                }]
            }
        }

        return message
    }

    const setPodMessages = (podId: string, messages: Message[]): void => {
        store.messagesByPodId.set(podId, messages)
    }

    const setTyping = (podId: string, isTyping: boolean): void => {
        store.isTypingByPodId.set(podId, isTyping)
    }

    const clearMessagesByPodIds = (podIds: string[]): void => {
        podIds.forEach(podId => {
            store.messagesByPodId.delete(podId)
            store.isTypingByPodId.delete(podId)
        })
    }

    const handleMessagesClearedEvent = async (payload: PodMessagesClearedPayload): Promise<void> => {
        clearMessagesByPodIds([payload.podId])

        const {usePodStore} = await import('../pod/podStore')
        const podStore = usePodStore()
        podStore.clearPodOutputsByIds([payload.podId])
    }

    const handleWorkflowAutoCleared = async (payload: WorkflowAutoClearedPayload): Promise<void> => {
        clearMessagesByPodIds(payload.clearedPodIds)

        const {usePodStore} = await import('../pod/podStore')
        const podStore = usePodStore()
        podStore.clearPodOutputsByIds(payload.clearedPodIds)

        store.autoClearAnimationPodId = payload.sourcePodId
    }

    return {
        addUserMessage,
        handleChatMessage,
        addNewChatMessage,
        updateExistingChatMessage,
        handleChatToolUse,
        createMessageWithToolUse,
        addToolUseToMessage,
        handleChatToolResult,
        updateToolUseResult,
        handleChatComplete,
        finalizeStreaming,
        completeMessage,
        updatePodOutput,
        convertPersistedToMessage,
        setPodMessages,
        setTyping,
        clearMessagesByPodIds,
        handleMessagesClearedEvent,
        handleWorkflowAutoCleared
    }
}
