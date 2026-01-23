import { defineStore } from 'pinia'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type { Message, ToolUseInfo, HistoryLoadingStatus, ToolUseStatus } from '@/types/chat'
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodChatHistoryResultPayload,
  PersistedMessage,
  PodErrorPayload,
  ConnectionReadyPayload
} from '@/types/websocket'

/**
 * WebSocket connection status types
 */
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Timeout duration for history loading (ms)
 */
const HISTORY_LOAD_TIMEOUT_MS = 10000

interface ChatState {
  messagesByPodId: Map<string, Message[]>
  isTypingByPodId: Map<string, boolean>
  currentStreamingMessageId: string | null
  connectionStatus: ConnectionStatus
  socketId: string | null
  historyLoadingStatus: Map<string, HistoryLoadingStatus>
  historyLoadingError: Map<string, string>
  allHistoryLoaded: boolean
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
    allHistoryLoaded: false
  }),

  getters: {
    /**
     * Get messages for a specific Pod
     */
    getMessages: (state) => {
      return (podId: string): Message[] => {
        return state.messagesByPodId.get(podId) || []
      }
    },

    /**
     * Check if assistant is typing for a Pod
     */
    isTyping: (state) => {
      return (podId: string): boolean => {
        return state.isTypingByPodId.get(podId) || false
      }
    },

    /**
     * Check if WebSocket is connected
     */
    isConnected: (state): boolean => {
      return state.connectionStatus === 'connected'
    },

    /**
     * Get history loading status for a Pod
     */
    getHistoryLoadingStatus: (state) => {
      return (podId: string): HistoryLoadingStatus => {
        return state.historyLoadingStatus.get(podId) || 'idle'
      }
    },

    /**
     * Check if history is loading for a Pod
     */
    isHistoryLoading: (state) => {
      return (podId: string): boolean => {
        return state.historyLoadingStatus.get(podId) === 'loading'
      }
    },

    /**
     * Check if all history is loaded
     */
    isAllHistoryLoaded: (state): boolean => {
      return state.allHistoryLoaded
    }
  },

  actions: {
    /**
     * Initialize WebSocket connection and register listeners
     */
    initWebSocket(): void {
      console.log('[ChatStore] Initializing WebSocket')

      this.connectionStatus = 'connecting'

      // Connect to WebSocket server
      websocketService.connect()

      // Register event listeners
      this.registerListeners()
    },

    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket(): void {
      console.log('[ChatStore] Disconnecting WebSocket')

      // Unregister listeners
      this.unregisterListeners()

      // Disconnect
      websocketService.disconnect()

      // Reset state
      this.connectionStatus = 'disconnected'
      this.socketId = null
    },

    /**
     * Register all WebSocket event listeners
     */
    registerListeners(): void {
      websocketService.onConnectionReady(this.handleConnectionReady)
      websocketService.onChatMessage(this.handleChatMessage)
      websocketService.onChatToolUse(this.handleChatToolUse)
      websocketService.onChatToolResult(this.handleChatToolResult)
      websocketService.onChatComplete(this.handleChatComplete)
      websocketService.onChatHistoryResult(this.handleChatHistoryResult)
      websocketService.onError(this.handleError)
    },

    /**
     * Unregister all WebSocket event listeners
     */
    unregisterListeners(): void {
      websocketService.offConnectionReady(this.handleConnectionReady)
      websocketService.offChatMessage(this.handleChatMessage)
      websocketService.offChatToolUse(this.handleChatToolUse)
      websocketService.offChatToolResult(this.handleChatToolResult)
      websocketService.offChatComplete(this.handleChatComplete)
      websocketService.offChatHistoryResult(this.handleChatHistoryResult)
      websocketService.offError(this.handleError)
    },

    /**
     * Handle connection ready event
     */
    handleConnectionReady(payload: ConnectionReadyPayload): void {
      console.log('[ChatStore] Connection ready:', payload)
      this.connectionStatus = 'connected'
      this.socketId = payload.socketId
    },

    /**
     * Send user message to a Pod
     */
    async sendMessage(podId: string, content: string): Promise<void> {
      if (!this.isConnected) {
        console.error('[ChatStore] Cannot send message, not connected')
        throw new Error('WebSocket not connected')
      }

      if (!content.trim()) {
        console.warn('[ChatStore] Attempted to send empty message')
        return
      }

      // Add user message to local state
      this.addUserMessage(podId, content)

      // Generate request ID
      const requestId = generateRequestId()

      // Emit message to server
      websocketService.podChatSend({
        requestId,
        podId,
        message: content
      })

      // Set typing indicator
      this.setTyping(podId, true)
    },

    /**
     * Add user message to local state
     */
    addUserMessage(podId: string, content: string): void {
      const userMessage: Message = {
        id: generateRequestId(),
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      }

      const messages = this.messagesByPodId.get(podId) || []
      this.messagesByPodId.set(podId, [...messages, userMessage])
    },

    /**
     * Handle incoming chat message (streaming)
     */
    handleChatMessage(payload: PodChatMessagePayload): void {
      console.log('[ChatStore] Chat message:', payload)

      const { podId, messageId, content, isPartial } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        // Create new assistant message
        const newMessage: Message = {
          id: messageId,
          role: 'assistant',
          content,
          isPartial,
          timestamp: new Date().toISOString()
        }
        this.messagesByPodId.set(podId, [...messages, newMessage])
        this.currentStreamingMessageId = messageId
      } else {
        // Update existing message immutably
        const updatedMessages = [...messages]
        const existingMessage = updatedMessages[messageIndex]
        if (existingMessage) {
          updatedMessages[messageIndex] = {
            ...existingMessage,
            content,
            isPartial
          }
          this.messagesByPodId.set(podId, updatedMessages)
        }
      }

      // Keep typing indicator active if still partial
      if (isPartial) {
        this.setTyping(podId, true)
      }
    },

    /**
     * Handle tool use notification
     */
    handleChatToolUse(payload: PodChatToolUsePayload): void {
      console.log('[ChatStore] Tool use:', payload)

      const { podId, messageId, toolName, input } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        console.warn('[ChatStore] Message not found for tool use:', messageId)
        return
      }

      const updatedMessages = [...messages]
      const message = updatedMessages[messageIndex]
      if (!message) return

      const toolUse = message.toolUse || []
      const toolIndex = toolUse.findIndex(t => t.toolName === toolName)

      const toolUseInfo: ToolUseInfo = {
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

    /**
     * Handle tool result
     */
    handleChatToolResult(payload: PodChatToolResultPayload): void {
      console.log('[ChatStore] Tool result:', payload)

      const { podId, messageId, toolName, output } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        console.warn('[ChatStore] Message not found for tool result:', messageId)
        return
      }

      const updatedMessages = [...messages]
      const message = updatedMessages[messageIndex]
      if (!message?.toolUse) return

      const updatedToolUse = message.toolUse.map(tool =>
        tool.toolName === toolName
          ? { ...tool, output, status: 'completed' as ToolUseStatus }
          : tool
      )

      updatedMessages[messageIndex] = {
        ...message,
        toolUse: updatedToolUse
      }

      this.messagesByPodId.set(podId, updatedMessages)
    },

    /**
     * Handle chat completion
     */
    handleChatComplete(payload: PodChatCompletePayload): void {
      console.log('[ChatStore] Chat complete:', payload)

      const { podId, messageId, fullContent } = payload
      const messages = this.messagesByPodId.get(podId) || []

      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        const updatedMessages = [...messages]
        const existingMessage = updatedMessages[messageIndex]
        if (existingMessage) {
          updatedMessages[messageIndex] = {
            ...existingMessage,
            content: fullContent,
            isPartial: false
          }
          this.messagesByPodId.set(podId, updatedMessages)
        }
      }

      // Clear typing indicator
      this.setTyping(podId, false)

      // Clear streaming message ID
      if (this.currentStreamingMessageId === messageId) {
        this.currentStreamingMessageId = null
      }
    },

    /**
     * Handle error events
     */
    handleError(payload: PodErrorPayload): void {
      console.error('[ChatStore] Error:', payload)

      // Update connection status if error is connection-related
      if (!websocketService.isConnected.value) {
        this.connectionStatus = 'error'
      }

      // Clear typing indicators for the affected pod
      if (payload.podId) {
        this.setTyping(payload.podId, false)
      }

      // TODO: Show error notification to user
    },

    /**
     * Set typing indicator for a Pod
     */
    setTyping(podId: string, isTyping: boolean): void {
      this.isTypingByPodId.set(podId, isTyping)
    },

    /**
     * Clear messages for a Pod
     */
    clearMessages(podId: string): void {
      this.messagesByPodId.delete(podId)
      this.isTypingByPodId.delete(podId)
    },

    /**
     * Convert PersistedMessage to Message format
     */
    convertPersistedToMessage(persistedMessage: PersistedMessage): Message {
      return {
        id: persistedMessage.id,
        role: persistedMessage.role,
        content: persistedMessage.content,
        timestamp: persistedMessage.timestamp,
        isPartial: false
      }
    },

    /**
     * Set Pod messages directly (used when loading history)
     */
    setPodMessages(podId: string, messages: Message[]): void {
      this.messagesByPodId.set(podId, messages)
    },

    /**
     * Set history loading status for a Pod
     */
    setHistoryLoadingStatus(podId: string, status: HistoryLoadingStatus): void {
      this.historyLoadingStatus.set(podId, status)
    },

    /**
     * Set history loading error for a Pod
     */
    setHistoryLoadingError(podId: string, error: string): void {
      this.historyLoadingError.set(podId, error)
    },

    /**
     * Load chat history for a single Pod
     */
    async loadPodChatHistory(podId: string): Promise<void> {
      // Check if already loaded or loading
      const currentStatus = this.historyLoadingStatus.get(podId)
      if (currentStatus === 'loaded' || currentStatus === 'loading') {
        console.log(`[ChatStore] Pod ${podId} history already ${currentStatus}`)
        return
      }

      // Check if connected
      if (!this.isConnected) {
        const error = 'WebSocket not connected'
        console.error(`[ChatStore] Cannot load history: ${error}`)
        this.setHistoryLoadingStatus(podId, 'error')
        this.setHistoryLoadingError(podId, error)
        throw new Error(error)
      }

      console.log(`[ChatStore] Loading chat history for pod: ${podId}`)
      this.setHistoryLoadingStatus(podId, 'loading')

      return new Promise<void>((resolve, reject) => {
        const requestId = generateRequestId()
        let timeoutId: ReturnType<typeof setTimeout>

        // Create one-time listener for the response
        const handleHistoryResult = (payload: PodChatHistoryResultPayload): void => {
          if (payload.requestId !== requestId) return

          websocketService.offChatHistoryResult(handleHistoryResult)
          clearTimeout(timeoutId)

          if (payload.success) {
            const messages = (payload.messages || []).map(msg =>
              this.convertPersistedToMessage(msg)
            )
            this.setPodMessages(podId, messages)
            this.setHistoryLoadingStatus(podId, 'loaded')
            console.log(`[ChatStore] Loaded ${messages.length} messages for pod: ${podId}`)
            resolve()
          } else {
            const error = payload.error || 'Unknown error'
            console.error(`[ChatStore] Failed to load history for pod ${podId}:`, error)
            this.setHistoryLoadingStatus(podId, 'error')
            this.setHistoryLoadingError(podId, error)
            reject(new Error(error))
          }
        }

        // Set timeout
        timeoutId = setTimeout(() => {
          websocketService.offChatHistoryResult(handleHistoryResult)
          const error = 'History load timeout'
          console.error(`[ChatStore] ${error} for pod: ${podId}`)
          this.setHistoryLoadingStatus(podId, 'error')
          this.setHistoryLoadingError(podId, error)
          reject(new Error(error))
        }, HISTORY_LOAD_TIMEOUT_MS)

        // Register listener
        websocketService.onChatHistoryResult(handleHistoryResult)

        // Send request
        websocketService.podChatHistory({
          requestId,
          podId
        })
      })
    },

    /**
     * Load chat history for all Pods in parallel
     */
    async loadAllPodsHistory(podIds: string[]): Promise<void> {
      if (podIds.length === 0) {
        console.log('[ChatStore] No pods to load history for')
        this.allHistoryLoaded = true
        return
      }

      console.log(`[ChatStore] Loading history for ${podIds.length} pods`)

      const results = await Promise.allSettled(
        podIds.map(podId => this.loadPodChatHistory(podId))
      )

      // Count successes and failures
      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      console.log(`[ChatStore] History load complete: ${successCount} succeeded, ${failureCount} failed`)

      if (failureCount > 0) {
        const failures = results
          .map((r, i) => r.status === 'rejected' ? podIds[i] : null)
          .filter((id): id is string => id !== null)
        console.warn('[ChatStore] Failed to load history for pods:', failures)
      }

      this.allHistoryLoaded = true
    },

    /**
     * Handle chat history result event
     */
    handleChatHistoryResult(payload: PodChatHistoryResultPayload): void {
      console.log('[ChatStore] Chat history result:', payload)
      // The actual handling is done in loadPodChatHistory's one-time listener
      // This is here in case we need global handling in the future
    }
  }
})
