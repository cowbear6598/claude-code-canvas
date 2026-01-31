import {
    createWebSocketRequest,
    WebSocketRequestEvents,
    WebSocketResponseEvents
} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import type {HistoryLoadingStatus} from '@/types/chat'
import type {
    PodChatHistoryPayload,
    PodChatHistoryResultPayload,
    PersistedMessage
} from '@/types/websocket'

const HISTORY_LOAD_TIMEOUT_MS = 10000

interface HistoryActionsContext {
    historyLoadingStatus: Map<string, HistoryLoadingStatus>
    historyLoadingError: Map<string, string>
    allHistoryLoaded: boolean
    isConnected: boolean
    setHistoryLoadingStatus: (podId: string, status: HistoryLoadingStatus) => void
    setHistoryLoadingError: (podId: string, error: string) => void
    setAllHistoryLoaded: (loaded: boolean) => void
    setPodMessages: (podId: string, messages: import('@/types/chat').Message[]) => void
    convertPersistedToMessage: (persistedMessage: PersistedMessage) => import('@/types/chat').Message
}

export function createHistoryActions(context: HistoryActionsContext): {
    setHistoryLoadingStatus: (podId: string, status: HistoryLoadingStatus) => void
    setHistoryLoadingError: (podId: string, error: string) => void
    loadPodChatHistory: (podId: string) => Promise<void>
    loadAllPodsHistory: (podIds: string[]) => Promise<void>
} {
    const setHistoryLoadingStatus = (podId: string, status: HistoryLoadingStatus): void => {
        context.historyLoadingStatus.set(podId, status)
    }

    const setHistoryLoadingError = (podId: string, error: string): void => {
        context.historyLoadingError.set(podId, error)
    }

    const loadPodChatHistory = async (podId: string): Promise<void> => {
        const currentStatus = context.historyLoadingStatus.get(podId)
        if (currentStatus === 'loaded' || currentStatus === 'loading') {
            return
        }

        if (!context.isConnected) {
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
            context.convertPersistedToMessage(msg)
        )
        context.setPodMessages(podId, messages)
        setHistoryLoadingStatus(podId, 'loaded')
    }

    const loadAllPodsHistory = async (podIds: string[]): Promise<void> => {
        if (podIds.length === 0) {
            context.setAllHistoryLoaded(true)
            return
        }

        await Promise.allSettled(
            podIds.map(podId => loadPodChatHistory(podId))
        )

        context.setAllHistoryLoaded(true)
    }

    return {
        setHistoryLoadingStatus,
        setHistoryLoadingError,
        loadPodChatHistory,
        loadAllPodsHistory
    }
}
