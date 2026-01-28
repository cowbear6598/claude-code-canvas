import { defineStore } from 'pinia'
import { websocketClient, createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import type { Message, ToolUseInfo, HistoryLoadingStatus, ToolUseStatus } from '@/types/chat'
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodChatHistoryResultPayload,
  PodChatHistoryPayload,
  PodChatSendPayload,
  PersistedMessage,
  PodErrorPayload,
  ConnectionReadyPayload,
  PodMessagesClearedPayload,
  WorkflowAutoClearedPayload
} from '@/types/websocket'
import { RESPONSE_PREVIEW_LENGTH, CONTENT_PREVIEW_LENGTH } from '@/lib/constants'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const HISTORY_LOAD_TIMEOUT_MS = 10000

const truncateContent = (content: string, maxLength: number): string => {
  return content.length > maxLength
    ? `${content.slice(0, maxLength)}...`
    : content
}

interface ChatState {
  messagesByPodId: Map<string, Message[]>
  isTypingByPodId: Map<string, boolean>
  currentStreamingMessageId: string | null
  connectionStatus: ConnectionStatus
  socketId: string | null
  historyLoadingStatus: Map<string, HistoryLoadingStatus>
  historyLoadingError: Map<string, string>
  allHistoryLoaded: boolean
  autoClearAnimationPodId: string | null
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messagesByPodId: new Map(),
    isTypingByPodId: new Map(),
    currentStreamingMessageId: null,
    connectionStatus: 'disconnected',
    socketId: null,
    historyLoadingStatus: new Map(),
    historyLoadingError: new Map(),
    allHistoryLoaded: false,
    autoClearAnimationPodId: null
  }),

  getters: {
    getMessages: (state) => {
      return (podId: string): Message[] => {
        return state.messagesByPodId.get(podId) || []
      }
    },

    isTyping: (state) => {
      return (podId: string): boolean => {
        return state.isTypingByPodId.get(podId) || false
      }
    },

    isConnected: (state): boolean => {
      return state.connectionStatus === 'connected'
    },

    getHistoryLoadingStatus: (state) => {
      return (podId: string): HistoryLoadingStatus => {
        return state.historyLoadingStatus.get(podId) || 'idle'
      }
    },

    isHistoryLoading: (state) => {
      return (podId: string): boolean => {
        return state.historyLoadingStatus.get(podId) === 'loading'
      }
    },

    isAllHistoryLoaded: (state): boolean => {
      return state.allHistoryLoaded
    }
  },

  actions: {
    initWebSocket(): void {
      this.connectionStatus = 'connecting'
      websocketClient.connect()
      this.registerListeners()
    },

    disconnectWebSocket(): void {
      this.unregisterListeners()
      websocketClient.disconnect()

      this.connectionStatus = 'disconnected'
      this.socketId = null
    },

    registerListeners(): void {
      websocketClient.on<ConnectionReadyPayload>(WebSocketResponseEvents.CONNECTION_READY, this.handleConnectionReady)
      websocketClient.on<PodChatMessagePayload>(WebSocketResponseEvents.POD_CHAT_MESSAGE, this.handleChatMessage)
      websocketClient.on<PodChatToolUsePayload>(WebSocketResponseEvents.POD_CHAT_TOOL_USE, this.handleChatToolUse)
      websocketClient.on<PodChatToolResultPayload>(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, this.handleChatToolResult)
      websocketClient.on<PodChatCompletePayload>(WebSocketResponseEvents.POD_CHAT_COMPLETE, this.handleChatComplete)
      websocketClient.on<PodChatHistoryResultPayload>(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, this.handleChatHistoryResult)
      websocketClient.on<PodErrorPayload>(WebSocketResponseEvents.POD_ERROR, this.handleError)
      websocketClient.on<PodMessagesClearedPayload>(WebSocketResponseEvents.POD_MESSAGES_CLEARED, this.handleMessagesClearedEvent)
      websocketClient.on<WorkflowAutoClearedPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED, this.handleWorkflowAutoCleared)
    },

    unregisterListeners(): void {
      websocketClient.off<ConnectionReadyPayload>(WebSocketResponseEvents.CONNECTION_READY, this.handleConnectionReady)
      websocketClient.off<PodChatMessagePayload>(WebSocketResponseEvents.POD_CHAT_MESSAGE, this.handleChatMessage)
      websocketClient.off<PodChatToolUsePayload>(WebSocketResponseEvents.POD_CHAT_TOOL_USE, this.handleChatToolUse)
      websocketClient.off<PodChatToolResultPayload>(WebSocketResponseEvents.POD_CHAT_TOOL_RESULT, this.handleChatToolResult)
      websocketClient.off<PodChatCompletePayload>(WebSocketResponseEvents.POD_CHAT_COMPLETE, this.handleChatComplete)
      websocketClient.off<PodChatHistoryResultPayload>(WebSocketResponseEvents.POD_CHAT_HISTORY_RESULT, this.handleChatHistoryResult)
      websocketClient.off<PodErrorPayload>(WebSocketResponseEvents.POD_ERROR, this.handleError)
      websocketClient.off<PodMessagesClearedPayload>(WebSocketResponseEvents.POD_MESSAGES_CLEARED, this.handleMessagesClearedEvent)
      websocketClient.off<WorkflowAutoClearedPayload>(WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED, this.handleWorkflowAutoCleared)
    },

    handleConnectionReady(payload: ConnectionReadyPayload): void {
      this.connectionStatus = 'connected'
      this.socketId = payload.socketId
    },

    async sendMessage(podId: string, content: string): Promise<void> {
      if (!this.isConnected) {
        throw new Error('WebSocket not connected')
      }

      if (!content.trim()) {
        return
      }

      this.addUserMessage(podId, content)

      websocketClient.emit<PodChatSendPayload>(WebSocketRequestEvents.POD_CHAT_SEND, {
        requestId: generateRequestId(),
        podId,
        message: content
      })

      this.setTyping(podId, true)
    },

    addUserMessage(podId: string, content: string): void {
      const userMessage: Message = {
        id: generateRequestId(),
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      }

      const messages = this.messagesByPodId.get(podId) || []
      this.messagesByPodId.set(podId, [...messages, userMessage])

      import('./pod/podStore').then(({ usePodStore }) => {
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (pod) {
          const truncatedContent = `> ${truncateContent(content, CONTENT_PREVIEW_LENGTH)}`
          podStore.updatePod({
            ...pod,
            output: [...pod.output, truncatedContent]
          })
        }
      })
    },

    handleChatMessage(payload: PodChatMessagePayload): void {
      const { podId, messageId, content, isPartial, role } = payload
      const messages = this.messagesByPodId.get(podId) || []
      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        this.addNewChatMessage(podId, messageId, content, isPartial, role)
        return
      }

      this.updateExistingChatMessage(podId, messages, messageIndex, content, isPartial)
    },

    addNewChatMessage(podId: string, messageId: string, content: string, isPartial: boolean, role?: 'user' | 'assistant'): void {
      const messages = this.messagesByPodId.get(podId) || []
      const newMessage: Message = {
        id: messageId,
        role: role || 'assistant',
        content,
        isPartial,
        timestamp: new Date().toISOString()
      }

      this.messagesByPodId.set(podId, [...messages, newMessage])
      this.currentStreamingMessageId = messageId

      if (isPartial) {
        this.setTyping(podId, true)
      }
    },

    updateExistingChatMessage(podId: string, messages: Message[], messageIndex: number, content: string, isPartial: boolean): void {
      const updatedMessages = [...messages]
      const existingMessage = updatedMessages[messageIndex]

      if (!existingMessage) return

      updatedMessages[messageIndex] = {
        ...existingMessage,
        content,
        isPartial
      }

      this.messagesByPodId.set(podId, updatedMessages)

      if (isPartial) {
        this.setTyping(podId, true)
      }
    },

    handleChatToolUse(payload: PodChatToolUsePayload): void {
      const { podId, messageId, toolUseId, toolName, input } = payload
      const messages = this.messagesByPodId.get(podId) || []
      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        this.createMessageWithToolUse(podId, messageId, toolUseId, toolName, input)
        return
      }

      this.addToolUseToMessage(podId, messages, messageIndex, toolUseId, toolName, input)
    },

    createMessageWithToolUse(podId: string, messageId: string, toolUseId: string, toolName: string, input: Record<string, unknown>): void {
      const messages = this.messagesByPodId.get(podId) || []
      const newMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: '',
        isPartial: true,
        timestamp: new Date().toISOString(),
        toolUse: [{
          toolUseId,
          toolName,
          input,
          status: 'running' as ToolUseStatus
        }]
      }

      this.messagesByPodId.set(podId, [...messages, newMessage])
      this.currentStreamingMessageId = messageId
    },

    addToolUseToMessage(podId: string, messages: Message[], messageIndex: number, toolUseId: string, toolName: string, input: Record<string, unknown>): void {
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
        : toolUse.map((tool, idx) => idx === toolIndex ? toolUseInfo : tool)

      updatedMessages[messageIndex] = {
        ...message,
        toolUse: updatedToolUse
      }

      this.messagesByPodId.set(podId, updatedMessages)
    },

    handleChatToolResult(payload: PodChatToolResultPayload): void {
      const { podId, messageId, toolUseId, output } = payload
      const messages = this.messagesByPodId.get(podId) || []
      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) return

      const message = messages[messageIndex]
      if (!message?.toolUse) return

      this.updateToolUseResult(podId, messages, messageIndex, toolUseId, output)
    },

    updateToolUseResult(podId: string, messages: Message[], messageIndex: number, toolUseId: string, output: string): void {
      const updatedMessages = [...messages]
      const message = updatedMessages[messageIndex]

      if (!message?.toolUse) return

      const updatedToolUse = message.toolUse.map(tool =>
        tool.toolUseId === toolUseId
          ? { ...tool, output, status: 'completed' as ToolUseStatus }
          : tool
      )

      updatedMessages[messageIndex] = {
        ...message,
        toolUse: updatedToolUse
      }

      this.messagesByPodId.set(podId, updatedMessages)
    },

    handleChatComplete(payload: PodChatCompletePayload): void {
      const { podId, messageId, fullContent } = payload
      const messages = this.messagesByPodId.get(podId) || []
      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        this.finalizeStreaming(podId, messageId)
        return
      }

      this.completeMessage(podId, messages, messageIndex, fullContent, messageId)
    },

    finalizeStreaming(podId: string, messageId: string): void {
      this.setTyping(podId, false)

      if (this.currentStreamingMessageId === messageId) {
        this.currentStreamingMessageId = null
      }
    },

    completeMessage(podId: string, messages: Message[], messageIndex: number, fullContent: string, messageId: string): void {
      const updatedMessages = [...messages]
      const existingMessage = updatedMessages[messageIndex]

      if (!existingMessage) return

      const hasToolUse = existingMessage.toolUse && existingMessage.toolUse.length > 0

      if (hasToolUse) {
        const updatedToolUse = existingMessage.toolUse!.map(tool =>
          tool.status === 'running'
            ? { ...tool, status: 'completed' as ToolUseStatus }
            : tool
        )
        updatedMessages[messageIndex] = {
          ...existingMessage,
          content: fullContent,
          isPartial: false,
          toolUse: updatedToolUse
        }
      } else {
        updatedMessages[messageIndex] = {
          ...existingMessage,
          content: fullContent,
          isPartial: false
        }
      }

      this.messagesByPodId.set(podId, updatedMessages)

      if (existingMessage.role === 'assistant') {
        this.updatePodOutput(podId, fullContent)
      }

      this.finalizeStreaming(podId, messageId)
    },

    updatePodOutput(podId: string, content: string): void {
      import('./pod/podStore').then(({ usePodStore }) => {
        const podStore = usePodStore()
        const pod = podStore.pods.find(p => p.id === podId)

        if (!pod) return

        const truncatedContent = truncateContent(content, RESPONSE_PREVIEW_LENGTH)
        podStore.updatePod({
          ...pod,
          output: [...pod.output, truncatedContent]
        })
      })
    },

    handleError(payload: PodErrorPayload): void {
      if (!websocketClient.isConnected.value) {
        this.connectionStatus = 'error'
      }

      if (payload.podId) {
        this.setTyping(payload.podId, false)
      }
    },

    setTyping(podId: string, isTyping: boolean): void {
      this.isTypingByPodId.set(podId, isTyping)
    },

    clearMessagesByPodIds(podIds: string[]): void {
      podIds.forEach(podId => {
        this.messagesByPodId.delete(podId)
        this.isTypingByPodId.delete(podId)
        this.historyLoadingStatus.delete(podId)
        this.historyLoadingError.delete(podId)
      })
    },

    convertPersistedToMessage(persistedMessage: PersistedMessage): Message {
      return {
        id: persistedMessage.id,
        role: persistedMessage.role,
        content: persistedMessage.content,
        timestamp: persistedMessage.timestamp,
        isPartial: false
      }
    },

    setPodMessages(podId: string, messages: Message[]): void {
      this.messagesByPodId.set(podId, messages)
    },

    setHistoryLoadingStatus(podId: string, status: HistoryLoadingStatus): void {
      this.historyLoadingStatus.set(podId, status)
    },

    setHistoryLoadingError(podId: string, error: string): void {
      this.historyLoadingError.set(podId, error)
    },

    async loadPodChatHistory(podId: string): Promise<void> {
      const currentStatus = this.historyLoadingStatus.get(podId)
      if (currentStatus === 'loaded' || currentStatus === 'loading') {
        return
      }

      if (!this.isConnected) {
        const error = 'WebSocket not connected'
        this.setHistoryLoadingStatus(podId, 'error')
        this.setHistoryLoadingError(podId, error)
        throw new Error(error)
      }

      this.setHistoryLoadingStatus(podId, 'loading')

      const { wrapWebSocketRequest } = useWebSocketErrorHandler()

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
        this.setHistoryLoadingStatus(podId, 'error')
        return
      }

      const messages = (response.messages || []).map(msg =>
        this.convertPersistedToMessage(msg)
      )
      this.setPodMessages(podId, messages)
      this.setHistoryLoadingStatus(podId, 'loaded')
    },

    async loadAllPodsHistory(podIds: string[]): Promise<void> {
      if (podIds.length === 0) {
        this.allHistoryLoaded = true
        return
      }

      await Promise.allSettled(
        podIds.map(podId => this.loadPodChatHistory(podId))
      )

      this.allHistoryLoaded = true
    },

    handleChatHistoryResult(_: PodChatHistoryResultPayload): void {
    },

    handleMessagesClearedEvent(payload: PodMessagesClearedPayload): void {
      this.clearMessagesByPodIds([payload.podId])

      import('./pod/podStore').then(({ usePodStore }) => {
        const podStore = usePodStore()
        podStore.clearPodOutputsByIds([payload.podId])
      })
    },

    handleWorkflowAutoCleared(payload: WorkflowAutoClearedPayload): void {
      this.clearMessagesByPodIds(payload.clearedPodIds)

      import('./pod/podStore').then(({ usePodStore }) => {
        const podStore = usePodStore()
        podStore.clearPodOutputsByIds(payload.clearedPodIds)
      })

      this.autoClearAnimationPodId = payload.sourcePodId
    },

    clearAutoClearAnimation(): void {
      this.autoClearAnimationPodId = null
    }
  }
})
