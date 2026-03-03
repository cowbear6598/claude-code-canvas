import { getActiveCanvasIdOrWarn } from '@/utils/canvasGuard'
import { createWebSocketRequest } from '@/services/websocket'
import type { WebSocketRequestConfig } from '@/services/websocket/createWebSocketRequest'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'
import { useToast } from '@/composables/useToast'
import type { ToastCategory } from '@/composables/useToast'

export type WebSocketActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface CanvasWebSocketActionOptions {
  errorCategory: ToastCategory
  errorAction: string
  errorMessage: string
}

export function useCanvasWebSocketAction(): {
  executeAction: <TPayload extends { requestId: string }, TResponse>(
    config: Omit<WebSocketRequestConfig<TPayload, TResponse>, 'payload'> & {
      payload: Omit<TPayload, 'requestId' | 'canvasId'>
    },
    options: CanvasWebSocketActionOptions
  ) => Promise<WebSocketActionResult<TResponse>>
} {
  const { wrapWebSocketRequest } = useWebSocketErrorHandler()
  const { showErrorToast } = useToast()

  const executeAction = async <TPayload extends { requestId: string }, TResponse>(
    config: Omit<WebSocketRequestConfig<TPayload, TResponse>, 'payload'> & {
      payload: Omit<TPayload, 'requestId' | 'canvasId'>
    },
    options: CanvasWebSocketActionOptions
  ): Promise<WebSocketActionResult<TResponse>> => {
    const canvasId = getActiveCanvasIdOrWarn('useCanvasWebSocketAction')
    if (!canvasId) {
      return { success: false, error: '沒有啟用的畫布' }
    }

    const response = await wrapWebSocketRequest(
      createWebSocketRequest<TPayload, TResponse>({
        requestEvent: config.requestEvent,
        responseEvent: config.responseEvent,
        timeout: config.timeout,
        matchResponse: config.matchResponse,
        payload: {
          ...config.payload,
          canvasId,
        } as unknown as Omit<TPayload, 'requestId'>
      })
    )

    if (!response) {
      showErrorToast(options.errorCategory, options.errorAction)
      return { success: false, error: options.errorMessage }
    }

    return { success: true, data: response }
  }

  return { executeAction }
}
