import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { mockWebSocketModule, resetMockWebSocket, mockWebSocketClient } from '../../helpers/mockWebSocket'
import { createMockPod } from '../../helpers/factories'
import { useChatStore } from '@/stores/chat/chatStore'
import { usePodStore } from '@/stores/pod/podStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useCommandStore } from '@/stores/note/commandStore'
import type { ContentBlock, TextContentBlock } from '@/types/websocket'

vi.mock('@/services/websocket', async () => {
  const actual = await vi.importActual<typeof import('@/services/websocket')>('@/services/websocket')
  return {
    ...mockWebSocketModule(),
    WebSocketRequestEvents: actual.WebSocketRequestEvents,
    WebSocketResponseEvents: actual.WebSocketResponseEvents,
  }
})

vi.mock('@/composables/useToast', () => {
  return {
    useToast: () => ({
      toast: vi.fn(),
      showSuccessToast: vi.fn(),
      showErrorToast: vi.fn(),
    }),
  }
})

describe('chatStore', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    resetMockWebSocket()
    vi.clearAllMocks()
  })

  describe('初始狀態', () => {
    it('messagesByPodId 應為空 Map', () => {
      const store = useChatStore()

      expect(store.messagesByPodId).toBeInstanceOf(Map)
      expect(store.messagesByPodId.size).toBe(0)
    })

    it('isTypingByPodId 應為空 Map', () => {
      const store = useChatStore()

      expect(store.isTypingByPodId).toBeInstanceOf(Map)
      expect(store.isTypingByPodId.size).toBe(0)
    })

    it('currentStreamingMessageId 應為 null', () => {
      const store = useChatStore()

      expect(store.currentStreamingMessageId).toBeNull()
    })

    it('connectionStatus 應為 disconnected', () => {
      const store = useChatStore()

      expect(store.connectionStatus).toBe('disconnected')
    })

    it('allHistoryLoaded 應為 false', () => {
      const store = useChatStore()

      expect(store.allHistoryLoaded).toBe(false)
    })

    it('autoClearAnimationPodId 應為 null', () => {
      const store = useChatStore()

      expect(store.autoClearAnimationPodId).toBeNull()
    })
  })

  describe('getters', () => {
    describe('getMessages', () => {
      it('應回傳指定 podId 的訊息陣列', () => {
        const store = useChatStore()
        const messages = [
          { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: '2024-01-01' },
          { id: 'msg-2', role: 'assistant' as const, content: 'Hi', timestamp: '2024-01-01' },
        ]
        store.messagesByPodId.set('pod-1', messages)

        const result = store.getMessages('pod-1')

        expect(result).toEqual(messages)
      })

      it('podId 不存在時應回傳空陣列', () => {
        const store = useChatStore()

        const result = store.getMessages('non-existent')

        expect(result).toEqual([])
      })
    })

    describe('isTyping', () => {
      it('應回傳指定 podId 的打字狀態', () => {
        const store = useChatStore()
        store.isTypingByPodId.set('pod-1', true)

        expect(store.isTyping('pod-1')).toBe(true)
      })

      it('podId 不存在時應回傳 false', () => {
        const store = useChatStore()

        expect(store.isTyping('non-existent')).toBe(false)
      })
    })

    describe('isConnected', () => {
      it('connectionStatus 為 connected 時應回傳 true', () => {
        const store = useChatStore()
        store.connectionStatus = 'connected'

        expect(store.isConnected).toBe(true)
      })

      it('connectionStatus 為 disconnected 時應回傳 false', () => {
        const store = useChatStore()
        store.connectionStatus = 'disconnected'

        expect(store.isConnected).toBe(false)
      })

      it('connectionStatus 為 connecting 時應回傳 false', () => {
        const store = useChatStore()
        store.connectionStatus = 'connecting'

        expect(store.isConnected).toBe(false)
      })

      it('connectionStatus 為 error 時應回傳 false', () => {
        const store = useChatStore()
        store.connectionStatus = 'error'

        expect(store.isConnected).toBe(false)
      })
    })

    describe('getHistoryLoadingStatus', () => {
      it('應回傳指定 podId 的載入狀態', () => {
        const store = useChatStore()
        store.historyLoadingStatus.set('pod-1', 'loading')

        expect(store.getHistoryLoadingStatus('pod-1')).toBe('loading')
      })

      it('podId 不存在時應回傳 idle', () => {
        const store = useChatStore()

        expect(store.getHistoryLoadingStatus('non-existent')).toBe('idle')
      })
    })

    describe('isHistoryLoading', () => {
      it('狀態為 loading 時應回傳 true', () => {
        const store = useChatStore()
        store.historyLoadingStatus.set('pod-1', 'loading')

        expect(store.isHistoryLoading('pod-1')).toBe(true)
      })

      it('狀態為 idle 時應回傳 false', () => {
        const store = useChatStore()
        store.historyLoadingStatus.set('pod-1', 'idle')

        expect(store.isHistoryLoading('pod-1')).toBe(false)
      })

      it('狀態為 loaded 時應回傳 false', () => {
        const store = useChatStore()
        store.historyLoadingStatus.set('pod-1', 'loaded')

        expect(store.isHistoryLoading('pod-1')).toBe(false)
      })
    })

    describe('isAllHistoryLoaded', () => {
      it('allHistoryLoaded 為 true 時應回傳 true', () => {
        const store = useChatStore()
        store.allHistoryLoaded = true

        expect(store.isAllHistoryLoaded).toBe(true)
      })

      it('allHistoryLoaded 為 false 時應回傳 false', () => {
        const store = useChatStore()
        store.allHistoryLoaded = false

        expect(store.isAllHistoryLoaded).toBe(false)
      })
    })

    describe('getDisconnectReason', () => {
      it('應回傳 disconnectReason', () => {
        const store = useChatStore()
        store.disconnectReason = 'Server timeout'

        expect(store.getDisconnectReason).toBe('Server timeout')
      })

      it('disconnectReason 為 null 時應回傳 null', () => {
        const store = useChatStore()
        store.disconnectReason = null

        expect(store.getDisconnectReason).toBeNull()
      })
    })
  })

  describe('sendMessage', () => {
    it('成功時應 emit WebSocket 事件並設定 isTyping 為 true', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const podStore = usePodStore()
      const pod = createMockPod({ id: 'pod-1', commandId: null })
      podStore.pods = [pod]
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.sendMessage('pod-1', 'Hello')

      expect(mockWebSocketClient.emit).toHaveBeenCalledWith('pod:chat:send', {
        requestId: expect.any(String),
        canvasId: 'canvas-1',
        podId: 'pod-1',
        message: 'Hello',
      })
      expect(store.isTypingByPodId.get('pod-1')).toBe(true)
    })

    it('包含 Command 時應在訊息前綴加上 /{commandName}', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const podStore = usePodStore()
      const commandStore = useCommandStore()
      const pod = createMockPod({ id: 'pod-1', commandId: 'cmd-1' })
      podStore.pods = [pod]
      commandStore.availableItems = [{ id: 'cmd-1', name: 'test-command' } as any]
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.sendMessage('pod-1', 'run this')

      expect(mockWebSocketClient.emit).toHaveBeenCalledWith('pod:chat:send', {
        requestId: expect.any(String),
        canvasId: 'canvas-1',
        podId: 'pod-1',
        message: '/test-command run this',
      })
    })

    it('含 contentBlocks 時應組裝 blocks 格式', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const podStore = usePodStore()
      const pod = createMockPod({ id: 'pod-1', commandId: null })
      podStore.pods = [pod]
      const store = useChatStore()
      store.connectionStatus = 'connected'

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'Check this' },
        { type: 'image', mediaType: 'image/png', base64Data: 'abc123' },
      ]

      await store.sendMessage('pod-1', '', contentBlocks)

      expect(mockWebSocketClient.emit).toHaveBeenCalledWith('pod:chat:send', {
        requestId: expect.any(String),
        canvasId: 'canvas-1',
        podId: 'pod-1',
        message: contentBlocks,
      })
    })

    it('contentBlocks 含 text 且有 command 時應在第一個 text block 前綴 command', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const podStore = usePodStore()
      const commandStore = useCommandStore()
      const pod = createMockPod({ id: 'pod-1', commandId: 'cmd-1' })
      podStore.pods = [pod]
      commandStore.availableItems = [{ id: 'cmd-1', name: 'analyze' } as any]
      const store = useChatStore()
      store.connectionStatus = 'connected'

      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: 'this file' },
        { type: 'image', mediaType: 'image/png', base64Data: 'xyz' },
      ]

      await store.sendMessage('pod-1', '', contentBlocks)

      const emittedBlocks = (mockWebSocketClient.emit.mock.calls[0]![1] as any).message as ContentBlock[]
      expect((emittedBlocks[0] as TextContentBlock).text).toBe('/analyze this file')
    })

    it('activeCanvasId 為 null 時不應發送 WebSocket 事件', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const podStore = usePodStore()
      const pod = createMockPod({ id: 'pod-1', commandId: null })
      podStore.pods = [pod]
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.sendMessage('pod-1', 'Hello')

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('空白訊息時不應發送', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.sendMessage('pod-1', '   ')

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('空白訊息且無 contentBlocks 時不應發送', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.sendMessage('pod-1', '', [])

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('未連線時應 throw Error', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'disconnected'

      await expect(store.sendMessage('pod-1', 'Hello')).rejects.toThrow('WebSocket not connected')
    })
  })

  describe('abortChat', () => {
    it('已連線時應 emit POD_CHAT_ABORT 事件', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.abortChat('pod-1')

      expect(mockWebSocketClient.emit).toHaveBeenCalledWith('pod:chat:abort', {
        requestId: expect.any(String),
        canvasId: 'canvas-1',
        podId: 'pod-1',
      })
    })

    it('activeCanvasId 為 null 時不應發送 WebSocket 事件', async () => {
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = null
      const store = useChatStore()
      store.connectionStatus = 'connected'

      await store.abortChat('pod-1')

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('未連線時不應發送 WebSocket 事件', async () => {
      const store = useChatStore()
      store.connectionStatus = 'disconnected'

      await store.abortChat('pod-1')

      expect(mockWebSocketClient.emit).not.toHaveBeenCalled()
    })

    it('未連線時應立即重設 isTyping 狀態，避免卡在 chatting', async () => {
      const store = useChatStore()
      store.connectionStatus = 'disconnected'
      store.isTypingByPodId.set('pod-1', true)

      await store.abortChat('pod-1')

      expect(store.isTypingByPodId.get('pod-1')).toBe(false)
    })

    it('已連線時若 10 秒後仍在 typing，應強制重設 isTyping', async () => {
      vi.useFakeTimers()
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'
      store.isTypingByPodId.set('pod-1', true)

      await store.abortChat('pod-1')

      // 尚未超時，isTyping 仍為 true
      expect(store.isTypingByPodId.get('pod-1')).toBe(true)

      // 觸發 10 秒超時
      vi.advanceTimersByTime(10000)

      expect(store.isTypingByPodId.get('pod-1')).toBe(false)

      vi.useRealTimers()
    })

    it('已連線時若 10 秒內 isTyping 已被正常重設，安全超時不應重複觸發', async () => {
      vi.useFakeTimers()
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'
      store.isTypingByPodId.set('pod-1', true)

      await store.abortChat('pod-1')

      // 模擬正常收到 abort 回應後 isTyping 被重設
      store.setTyping('pod-1', false)

      vi.advanceTimersByTime(10000)

      // isTyping 應維持 false（安全超時不應造成額外影響）
      expect(store.isTypingByPodId.get('pod-1')).toBe(false)

      vi.useRealTimers()
    })

    it('setTyping(false) 後安全超時 timer 應被清除，不再觸發', async () => {
      vi.useFakeTimers()
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'
      store.isTypingByPodId.set('pod-1', true)

      await store.abortChat('pod-1')

      // 模擬正常收到 abort 回應後 isTyping 被重設，timer 應被清除
      store.setTyping('pod-1', false)

      // 手動將 isTyping 再設回 true，模擬新的 chat 開始
      store.isTypingByPodId.set('pod-1', true)

      // 舊的 timer 應已被清除，不應干擾新的 chat
      vi.advanceTimersByTime(10000)
      expect(store.isTypingByPodId.get('pod-1')).toBe(true)

      vi.useRealTimers()
    })

    it('連續兩次 abort 時，新的 abort 應覆蓋舊的 timer', async () => {
      vi.useFakeTimers()
      const canvasStore = useCanvasStore()
      canvasStore.activeCanvasId = 'canvas-1'
      const store = useChatStore()
      store.connectionStatus = 'connected'
      store.isTypingByPodId.set('pod-1', true)

      // 第一次 abort
      await store.abortChat('pod-1')

      // 推進 5 秒（舊 timer 尚未觸發）
      vi.advanceTimersByTime(5000)
      expect(store.isTypingByPodId.get('pod-1')).toBe(true)

      // 第二次 abort，應清除舊 timer 並設置新的 10 秒 timer
      await store.abortChat('pod-1')

      // 再推進 5 秒（若舊 timer 未清除，應在此觸發；但新 timer 剩 10 秒）
      vi.advanceTimersByTime(5000)
      expect(store.isTypingByPodId.get('pod-1')).toBe(true)

      // 再推進 5 秒，新 timer 觸發
      vi.advanceTimersByTime(5000)
      expect(store.isTypingByPodId.get('pod-1')).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('handleChatAborted', () => {
    it('收到 aborted 事件後 currentStreamingMessageId 應被清為 null', () => {
      const store = useChatStore()
      store.currentStreamingMessageId = 'msg-1'

      store.handleChatAborted({ podId: 'pod-1', messageId: 'msg-1' })

      expect(store.currentStreamingMessageId).toBeNull()
    })

    it('收到 aborted 事件且訊息存在時，訊息的 isPartial 應被設為 false', () => {
      const store = useChatStore()
      store.messagesByPodId.set('pod-1', [
        {
          id: 'msg-1',
          role: 'assistant',
          content: '部分回應...',
          isPartial: true,
          timestamp: '2024-01-01',
        },
      ])
      store.currentStreamingMessageId = 'msg-1'

      store.handleChatAborted({ podId: 'pod-1', messageId: 'msg-1' })

      const messages = store.messagesByPodId.get('pod-1')
      expect(messages?.[0]?.isPartial).toBe(false)
    })

    it('收到 aborted 事件且訊息不存在時（messageIndex === -1），isTyping 仍應被設為 false', () => {
      const store = useChatStore()
      store.isTypingByPodId.set('pod-1', true)

      store.handleChatAborted({ podId: 'pod-1', messageId: 'non-existent-msg' })

      expect(store.isTypingByPodId.get('pod-1')).toBe(false)
    })
  })

  describe('clearMessagesByPodIds', () => {
    it('應清除指定 podIds 的 messages', () => {
      const store = useChatStore()
      store.messagesByPodId.set('pod-1', [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: '' }])
      store.messagesByPodId.set('pod-2', [{ id: 'msg-2', role: 'user', content: 'Hello', timestamp: '' }])
      store.messagesByPodId.set('pod-3', [{ id: 'msg-3', role: 'user', content: 'Hey', timestamp: '' }])

      store.clearMessagesByPodIds(['pod-1', 'pod-2'])

      expect(store.messagesByPodId.has('pod-1')).toBe(false)
      expect(store.messagesByPodId.has('pod-2')).toBe(false)
      expect(store.messagesByPodId.has('pod-3')).toBe(true)
    })

    it('應清除指定 podIds 的 typing 狀態', () => {
      const store = useChatStore()
      store.isTypingByPodId.set('pod-1', true)
      store.isTypingByPodId.set('pod-2', true)
      store.isTypingByPodId.set('pod-3', true)

      store.clearMessagesByPodIds(['pod-1', 'pod-2'])

      expect(store.isTypingByPodId.has('pod-1')).toBe(false)
      expect(store.isTypingByPodId.has('pod-2')).toBe(false)
      expect(store.isTypingByPodId.has('pod-3')).toBe(true)
    })

    it('應清除 historyLoadingStatus', () => {
      const store = useChatStore()
      store.historyLoadingStatus.set('pod-1', 'loaded')
      store.historyLoadingStatus.set('pod-2', 'loading')
      store.historyLoadingStatus.set('pod-3', 'loaded')

      store.clearMessagesByPodIds(['pod-1', 'pod-2'])

      expect(store.historyLoadingStatus.has('pod-1')).toBe(false)
      expect(store.historyLoadingStatus.has('pod-2')).toBe(false)
      expect(store.historyLoadingStatus.has('pod-3')).toBe(true)
    })

    it('應清除 historyLoadingError', () => {
      const store = useChatStore()
      store.historyLoadingError.set('pod-1', 'Error 1')
      store.historyLoadingError.set('pod-2', 'Error 2')
      store.historyLoadingError.set('pod-3', 'Error 3')

      store.clearMessagesByPodIds(['pod-1', 'pod-2'])

      expect(store.historyLoadingError.has('pod-1')).toBe(false)
      expect(store.historyLoadingError.has('pod-2')).toBe(false)
      expect(store.historyLoadingError.has('pod-3')).toBe(true)
    })

    it('空陣列時不應清除任何資料', () => {
      const store = useChatStore()
      store.messagesByPodId.set('pod-1', [{ id: 'msg-1', role: 'user', content: 'Hi', timestamp: '' }])
      store.isTypingByPodId.set('pod-1', true)

      store.clearMessagesByPodIds([])

      expect(store.messagesByPodId.has('pod-1')).toBe(true)
      expect(store.isTypingByPodId.has('pod-1')).toBe(true)
    })
  })

  describe('clearAutoClearAnimation', () => {
    it('應清除 autoClearAnimationPodId', () => {
      const store = useChatStore()
      store.autoClearAnimationPodId = 'pod-1'

      store.clearAutoClearAnimation()

      expect(store.autoClearAnimationPodId).toBeNull()
    })

    it('autoClearAnimationPodId 已為 null 時不應報錯', () => {
      const store = useChatStore()
      store.autoClearAnimationPodId = null

      expect(() => store.clearAutoClearAnimation()).not.toThrow()
      expect(store.autoClearAnimationPodId).toBeNull()
    })
  })

  describe('registerListeners', () => {
    it('應註冊所有事件 listener', () => {
      const store = useChatStore()

      store.registerListeners()

      expect(mockWebSocketClient.on).toHaveBeenCalledWith('connection:ready', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:claude:chat:message', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:chat:tool_use', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:chat:tool_result', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:chat:complete', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:chat:aborted', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:error', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('pod:messages:cleared', expect.any(Function))
      expect(mockWebSocketClient.on).toHaveBeenCalledWith('workflow:auto-cleared', expect.any(Function))
      expect(mockWebSocketClient.onWithAck).toHaveBeenCalledWith('heartbeat:ping', expect.any(Function))
      expect(mockWebSocketClient.onDisconnect).toHaveBeenCalledWith(expect.any(Function))
    })

    it('註冊前應先取消註冊（呼叫 unregisterListeners）', () => {
      const store = useChatStore()
      const unregisterSpy = vi.spyOn(store, 'unregisterListeners')

      store.registerListeners()

      expect(unregisterSpy).toHaveBeenCalled()
    })
  })

  describe('unregisterListeners', () => {
    it('應取消所有事件 listener', () => {
      const store = useChatStore()
      store.registerListeners()
      mockWebSocketClient.off.mockClear()
      mockWebSocketClient.offWithAck.mockClear()
      mockWebSocketClient.offDisconnect.mockClear()

      store.unregisterListeners()

      expect(mockWebSocketClient.off).toHaveBeenCalledWith('connection:ready', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:claude:chat:message', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:chat:tool_use', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:chat:tool_result', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:chat:complete', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:chat:aborted', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:error', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('pod:messages:cleared', expect.any(Function))
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('workflow:auto-cleared', expect.any(Function))
      expect(mockWebSocketClient.offWithAck).toHaveBeenCalledWith('heartbeat:ping', expect.any(Function))
      expect(mockWebSocketClient.offDisconnect).toHaveBeenCalledWith(expect.any(Function))
    })
  })
})
