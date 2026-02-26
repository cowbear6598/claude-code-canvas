import type {Message, SubMessage} from '@/types/chat'
import type {PodChatAbortedPayload, PodChatCompletePayload} from '@/types/websocket'
import {RESPONSE_PREVIEW_LENGTH} from '@/lib/constants'
import {truncateContent} from './chatUtils'
import type {ChatStoreInstance} from './chatStore'
import {finalizeSubMessages, finalizeToolUse, updateMainMessageState} from './subMessageHelpers'
import {abortSafetyTimers} from './abortSafetyTimers'

function extractSubMessageLines(subMessages: SubMessage[] | undefined): string[] {
    if (!subMessages || subMessages.length === 0) return []
    return subMessages
        .filter(sub => sub.content)
        .map(sub => truncateContent(sub.content, RESPONSE_PREVIEW_LENGTH))
}

export function createMessageCompletionActions(store: ChatStoreInstance): {
    handleChatComplete: (payload: PodChatCompletePayload) => void
    handleChatAborted: (payload: PodChatAbortedPayload) => void
    finalizeStreaming: (podId: string, messageId: string) => void
    completeMessage: (podId: string, messages: Message[], messageIndex: number, fullContent: string, messageId: string) => void
    updatePodOutput: (podId: string) => Promise<void>
} {
    const setTyping = (podId: string, isTyping: boolean): void => {
        store.isTypingByPodId.set(podId, isTyping)

        if (!isTyping) {
            const timer = abortSafetyTimers.get(podId)
            if (timer) {
                clearTimeout(timer)
                abortSafetyTimers.delete(podId)
            }
        }
    }

    const updatePodOutput = async (podId: string): Promise<void> => {
        const {usePodStore} = await import('../pod/podStore')
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (!pod) return

        const messages = store.messagesByPodId.get(podId) || []
        const outputLines: string[] = []

        for (const message of messages) {
            if (message.role === 'user') {
                const userContent = message.content
                outputLines.push(`> ${truncateContent(userContent, RESPONSE_PREVIEW_LENGTH)}`)
            } else if (message.role === 'assistant') {
                outputLines.push(...extractSubMessageLines(message.subMessages))
            }
        }

        podStore.updatePod({
            ...pod,
            output: outputLines
        })
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

        const updatedToolUse = finalizeToolUse(existingMessage.toolUse)
        const finalizedSubMessages = finalizeSubMessages(existingMessage.subMessages)

        updatedMessages[messageIndex] = updateMainMessageState(
            existingMessage,
            fullContent,
            updatedToolUse,
            finalizedSubMessages
        )

        store.messagesByPodId.set(podId, updatedMessages)

        if (existingMessage.role === 'assistant') {
            updatePodOutput(podId)
        }

        finalizeStreaming(podId, messageId)
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

    const handleChatAborted = (payload: PodChatAbortedPayload): void => {
        const {podId, messageId} = payload

        store.accumulatedLengthByMessageId.delete(messageId)

        const messages = store.messagesByPodId.get(podId) || []
        const messageIndex = messages.findIndex(m => m.id === messageId)

        if (messageIndex !== -1) {
            completeMessage(podId, messages, messageIndex, messages[messageIndex]!.content, messageId)
        } else {
            finalizeStreaming(podId, messageId)
        }
    }

    return {
        handleChatComplete,
        handleChatAborted,
        finalizeStreaming,
        completeMessage,
        updatePodOutput,
    }
}
