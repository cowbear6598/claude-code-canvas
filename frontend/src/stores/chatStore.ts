import { defineStore } from 'pinia'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type { Message, ToolUseInfo } from '@/types/chat'
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PodErrorPayload,
  ConnectionReadyPayload
} from '@/types/websocket'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface ChatState {
  messagesByPodId: Map<string, Message[]>
  isTypingByPodId: Map<string, boolean>
  currentStreamingMessageId: string | null
  connectionStatus: ConnectionStatus
  socketId: string | null
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messagesByPodId: new Map(),
    isTypingByPodId: new Map(),
    currentStreamingMessageId: null,
    connectionStatus: 'disconnected',
    socketId: null
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
        content
      }

      const messages = this.messagesByPodId.get(podId) || []
      messages.push(userMessage)
      this.messagesByPodId.set(podId, messages)
    },

    /**
     * Handle incoming chat message (streaming)
     */
    handleChatMessage(payload: PodChatMessagePayload): void {
      console.log('[ChatStore] Chat message:', payload)

      const { podId, messageId, content, isPartial } = payload
      const messages = this.messagesByPodId.get(podId) || []

      // Find existing message or create new one
      let messageIndex = messages.findIndex(m => m.id === messageId)

      if (messageIndex === -1) {
        // Create new assistant message
        const newMessage: Message = {
          id: messageId,
          role: 'assistant',
          content,
          isPartial
        }
        messages.push(newMessage)
        this.currentStreamingMessageId = messageId
      } else {
        // Update existing message
        const existingMessage = messages[messageIndex]
        if (existingMessage) {
          messages[messageIndex] = {
            id: existingMessage.id,
            role: existingMessage.role,
            content,
            isPartial,
            toolUse: existingMessage.toolUse
          }
        }
      }

      this.messagesByPodId.set(podId, messages)

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

      // Find the message
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return

      const message = messages[messageIndex]
      if (!message) return

      // Initialize toolUse array if not exists
      if (!message.toolUse) {
        message.toolUse = []
      }

      // Add or update tool use info
      const toolIndex = message.toolUse.findIndex(t => t.toolName === toolName)

      const toolUseInfo: ToolUseInfo = {
        toolName,
        input,
        status: 'running'
      }

      if (toolIndex === -1) {
        message.toolUse.push(toolUseInfo)
      } else {
        message.toolUse[toolIndex] = toolUseInfo
      }

      this.messagesByPodId.set(podId, messages)
    },

    /**
     * Handle tool result
     */
    handleChatToolResult(payload: PodChatToolResultPayload): void {
      console.log('[ChatStore] Tool result:', payload)

      const { podId, messageId, toolName, output } = payload
      const messages = this.messagesByPodId.get(podId) || []

      // Find the message
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return

      const message = messages[messageIndex]
      if (!message) return

      // Find the tool use info
      const toolUseInfo = message.toolUse?.find(t => t.toolName === toolName)
      if (toolUseInfo) {
        toolUseInfo.output = output
        toolUseInfo.status = 'completed'
      }

      this.messagesByPodId.set(podId, messages)
    },

    /**
     * Handle chat completion
     */
    handleChatComplete(payload: PodChatCompletePayload): void {
      console.log('[ChatStore] Chat complete:', payload)

      const { podId, messageId, fullContent } = payload
      const messages = this.messagesByPodId.get(podId) || []

      // Find and update the message
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        const existingMessage = messages[messageIndex]
        if (existingMessage) {
          messages[messageIndex] = {
            id: existingMessage.id,
            role: existingMessage.role,
            content: fullContent,
            isPartial: false,
            toolUse: existingMessage.toolUse
          }
          this.messagesByPodId.set(podId, messages)
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
    }
  }
})
