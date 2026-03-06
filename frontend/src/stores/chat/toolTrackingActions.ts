import type {Message, ToolUseInfo} from '@/types/chat'
import type {PodChatToolResultPayload, PodChatToolUsePayload} from '@/types/websocket'
import type {ChatStoreInstance} from './chatStore'
import {appendToolToLastSubMessage, flushAndCreateNewSubMessage, markToolWithOutput, updateSubMessagesToolUseResult} from './subMessageHelpers'
import {getMessages, findMessageIndex} from './chatStoreHelpers'

export function createToolTrackingActions(store: ChatStoreInstance): {
    handleChatToolUse: (payload: PodChatToolUsePayload) => void
    createMessageWithToolUse: (podId: string, messageId: string, toolUseId: string, toolName: string, input: Record<string, unknown>) => void
    addToolUseToMessage: (podId: string, messages: Message[], messageIndex: number, toolUseId: string, toolName: string, input: Record<string, unknown>) => void
    handleChatToolResult: (payload: PodChatToolResultPayload) => void
    updateToolUseResult: (podId: string, messages: Message[], messageIndex: number, toolUseId: string, output: string) => void
} {
    const createMessageWithToolUse = (podId: string, messageId: string, toolUseId: string, toolName: string, input: Record<string, unknown>): void => {
        const messages = getMessages(store, podId)

        const existingMessage = messages.find(message => message.id === messageId)
        if (existingMessage?.toolUse?.some(tool => tool.toolUseId === toolUseId)) return

        const toolUseInfo: ToolUseInfo = {
            toolUseId,
            toolName,
            input,
            status: 'running'
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
            }]
        }

        store.messagesByPodId.set(podId, [...messages, newMessage])
        store.currentStreamingMessageId = messageId
    }

    const addToolUseToMessage = (podId: string, messages: Message[], messageIndex: number, toolUseId: string, toolName: string, input: Record<string, unknown>): void => {
        const updatedMessages = [...messages]
        const message = updatedMessages[messageIndex]

        if (!message) return

        const toolUse = message.toolUse || []
        const toolIndex = toolUse.findIndex(tool => tool.toolUseId === toolUseId)
        const toolUseInfo: ToolUseInfo = {toolUseId, toolName, input, status: 'running'}
        const updatedToolUse = toolIndex === -1 ? [...toolUse, toolUseInfo] : toolUse

        const updatedMessage: Message = {
            ...message,
            toolUse: updatedToolUse,
        }

        if (message.subMessages !== undefined && message.subMessages.length > 0) {
            const lastSub = message.subMessages[message.subMessages.length - 1]
            if (lastSub && lastSub.content.trim() === '') {
                updatedMessage.subMessages = appendToolToLastSubMessage(message.subMessages, toolUseInfo)
            } else {
                updatedMessage.subMessages = flushAndCreateNewSubMessage(message.subMessages, message.id, toolUseInfo)
            }
        }

        updatedMessages[messageIndex] = updatedMessage

        store.messagesByPodId.set(podId, updatedMessages)
    }

    const handleChatToolUse = (payload: PodChatToolUsePayload): void => {
        const {podId, messageId, toolUseId, toolName, input} = payload
        const messages = getMessages(store, podId)
        const messageIndex = findMessageIndex(messages, messageId)

        if (messageIndex === -1) {
            createMessageWithToolUse(podId, messageId, toolUseId, toolName, input)
            return
        }

        const existingMessage = messages[messageIndex]
        if (!existingMessage) return

        const toolAlreadyExists = existingMessage.toolUse?.some(tool => tool.toolUseId === toolUseId)
        if (toolAlreadyExists) return

        addToolUseToMessage(podId, messages, messageIndex, toolUseId, toolName, input)
    }

    const updateToolUseResult = (podId: string, messages: Message[], messageIndex: number, toolUseId: string, output: string): void => {
        const updatedMessages = [...messages]
        const message = updatedMessages[messageIndex]

        if (!message?.toolUse) return

        const updatedToolUse = markToolWithOutput(message.toolUse, toolUseId, output)

        const updatedMessage: Message = {
            ...message,
            toolUse: updatedToolUse
        }

        if (message.subMessages) {
            updatedMessage.subMessages = updateSubMessagesToolUseResult(
                message.subMessages,
                toolUseId,
                output
            )
        }

        updatedMessages[messageIndex] = updatedMessage

        store.messagesByPodId.set(podId, updatedMessages)
    }

    const handleChatToolResult = (payload: PodChatToolResultPayload): void => {
        const {podId, messageId, toolUseId, output} = payload
        const messages = getMessages(store, podId)
        const messageIndex = findMessageIndex(messages, messageId)

        if (messageIndex === -1) return

        const message = messages[messageIndex]
        if (!message?.toolUse) return

        updateToolUseResult(podId, messages, messageIndex, toolUseId, output)
    }

    return {
        handleChatToolUse,
        createMessageWithToolUse,
        addToolUseToMessage,
        handleChatToolResult,
        updateToolUseResult,
    }
}
