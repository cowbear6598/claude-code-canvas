import {
    websocketClient,
    WebSocketRequestEvents
} from '@/services/websocket'
import {useToast} from '@/composables/useToast'
import type {
    ConnectionReadyPayload,
    HeartbeatPingPayload,
    PodErrorPayload,
    PodJoinBatchPayload
} from '@/types/websocket'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const HEARTBEAT_CHECK_INTERVAL_MS = 5000
const HEARTBEAT_TIMEOUT_MS = 20000

interface ConnectionActionsContext {
    connectionStatus: ConnectionStatus
    socketId: string | null
    disconnectReason: string | null
    lastHeartbeatAt: number | null
    heartbeatCheckTimer: number | null
    allHistoryLoaded: boolean
    setConnectionStatus: (status: ConnectionStatus) => void
    setSocketId: (id: string | null) => void
    setDisconnectReason: (reason: string | null) => void
    setLastHeartbeatAt: (timestamp: number | null) => void
    setHeartbeatCheckTimer: (timer: number | null) => void
    setTyping: (podId: string, isTyping: boolean) => void
    registerListenersCallback: () => void
    unregisterListenersCallback: () => void
}

export function createConnectionActions(context: ConnectionActionsContext): {
    initWebSocket: () => void
    disconnectWebSocket: () => void
    handleConnectionReady: (payload: ConnectionReadyPayload) => Promise<void>
    handleHeartbeatPing: (payload: HeartbeatPingPayload, ack: (response?: unknown) => void) => void
    startHeartbeatCheck: () => void
    stopHeartbeatCheck: () => void
    handleSocketDisconnect: (reason: string) => void
    handleError: (payload: PodErrorPayload) => void
} {
    const initWebSocket = (): void => {
        context.setConnectionStatus('connecting')
        websocketClient.connect()
        context.registerListenersCallback()
    }

    const disconnectWebSocket = (): void => {
        stopHeartbeatCheck()
        context.unregisterListenersCallback()
        websocketClient.disconnect()

        context.setConnectionStatus('disconnected')
        context.setSocketId(null)
    }

    const handleConnectionReady = async (payload: ConnectionReadyPayload): Promise<void> => {
        context.setConnectionStatus('connected')
        context.setSocketId(payload.socketId)

        startHeartbeatCheck()

        if (context.allHistoryLoaded) {
            const {usePodStore} = await import('../pod/podStore')
            const podStore = usePodStore()
            const podIds = podStore.pods.map(p => p.id)

            if (podIds.length > 0) {
                websocketClient.emit<PodJoinBatchPayload>(WebSocketRequestEvents.POD_JOIN_BATCH, {podIds})
            }

            const {toast} = useToast()
            toast({
                title: '已重新連線',
                description: 'WebSocket 連線已恢復',
            })
        }
    }

    const handleHeartbeatPing = (_: HeartbeatPingPayload, ack: (response?: unknown) => void): void => {
        context.setLastHeartbeatAt(Date.now())

        ack({timestamp: Date.now()})

        if (context.connectionStatus !== 'connected') {
            context.setConnectionStatus('connected')
        }
    }

    const startHeartbeatCheck = (): void => {
        if (context.heartbeatCheckTimer !== null) {
            clearInterval(context.heartbeatCheckTimer)
        }

        const timer = window.setInterval(() => {
            if (context.lastHeartbeatAt === null) {
                return
            }

            const now = Date.now()
            const elapsed = now - context.lastHeartbeatAt

            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                context.setConnectionStatus('disconnected')

                const {toast} = useToast()
                toast({
                    title: '連線逾時',
                    description: '未收到伺服器心跳回應',
                })
            }
        }, HEARTBEAT_CHECK_INTERVAL_MS)

        context.setHeartbeatCheckTimer(timer)
    }

    const stopHeartbeatCheck = (): void => {
        if (context.heartbeatCheckTimer !== null) {
            clearInterval(context.heartbeatCheckTimer)
            context.setHeartbeatCheckTimer(null)
        }
    }

    const handleSocketDisconnect = (reason: string): void => {
        context.setDisconnectReason(reason)
        context.setConnectionStatus('disconnected')
        stopHeartbeatCheck()

        const {toast} = useToast()
        toast({
            title: '連線中斷',
            description: `原因: ${reason}`,
        })
    }

    const handleError = (payload: PodErrorPayload): void => {
        if (!websocketClient.isConnected.value) {
            context.setConnectionStatus('error')
        }

        if (payload.podId) {
            context.setTyping(payload.podId, false)
        }
    }

    return {
        initWebSocket,
        disconnectWebSocket,
        handleConnectionReady,
        handleHeartbeatPing,
        startHeartbeatCheck,
        stopHeartbeatCheck,
        handleSocketDisconnect,
        handleError
    }
}
