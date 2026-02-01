import {
    createWebSocketRequest,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import type {HistoryLoadingStatus, Message} from '@/types/chat'
import type {
    PodChatHistoryPayload,
    PodChatHistoryResultPayload,
    PersistedMessage
} from '@/types/websocket'
import type {ChatStoreInstance} from './chatStore'

const HISTORY_LOAD_TIMEOUT_MS = 10000

interface MessageActions {
    setPodMessages: (podId: string, messages: Message[]) => void
    convertPersistedToMessage: (persistedMessage: PersistedMessage) => Message
}

export function createHistoryActions(store: ChatStoreInstance, messageActions: MessageActions): {
    setHistoryLoadingStatus: (podId: string, status: HistoryLoadingStatus) => void
    setHistoryLoadingError: (podId: string, error: string) => void
    loadPodChatHistory: (podId: string) => Promise<void>
    loadAllPodsHistory: (podIds: string[]) => Promise<void>
} {
    const setHistoryLoadingStatus = (podId: string, status: HistoryLoadingStatus): void => {
        store.historyLoadingStatus.set(podId, status)
    }

    const setHistoryLoadingError = (podId: string, error: string): void => {
        store.historyLoadingError.set(podId, error)
    }

    const loadPodChatHistory = async (podId: string): Promise<void> => {
        const currentStatus = store.historyLoadingStatus.get(podId)
        if (currentStatus === 'loaded' || currentStatus === 'loading') {
            return
        }

        if (!store.isConnected) {
            const error = 'WebSocket not connected'
            setHistoryLoadingStatus(podId, 'error')
            setHistoryLoadingError(podId, error)
            throw new Error(error)
        }

        setHistoryLoadingStatus(podId, 'loading')

        const {wrapWebSocketRequest} = useWebSocketErrorHandler()

        const response = await wrapWebSocketRequest(
            createWebSocketRequest<PodChatHistoryPayload, PodChatHistoryResultPayload>({
                requestEvent: WebSocketRequestEvents.POD_CHAT_HISTORY,
                responseEvent: WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT,
                payload: {
                    podId
                },
                timeout: HISTORY_LOAD_TIMEOUT_MS
            }),
            '載入聊天歷史失敗'
        )

        if (!response) {
            setHistoryLoadingStatus(podId, 'error')
            return
        }

        const messages = (response.messages || []).map(msg =>
            messageActions.convertPersistedToMessage(msg)
        )
        messageActions.setPodMessages(podId, messages)
        setHistoryLoadingStatus(podId, 'loaded')
    }

    const loadAllPodsHistory = async (podIds: string[]): Promise<void> => {
        if (podIds.length === 0) {
            store.allHistoryLoaded = true
            return
        }

        await Promise.allSettled(
            podIds.map(podId => loadPodChatHistory(podId))
        )

        store.allHistoryLoaded = true
    }

    return {
        setHistoryLoadingStatus,
        setHistoryLoadingError,
        loadPodChatHistory,
        loadAllPodsHistory
    }
}
