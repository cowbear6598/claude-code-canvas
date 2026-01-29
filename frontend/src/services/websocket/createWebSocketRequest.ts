import { generateRequestId } from '@/services/utils'
import { websocketClient } from './WebSocketClient'

export interface WebSocketRequestConfig<TPayload, TResult> {
  requestEvent: string
  responseEvent: string
  payload: Omit<TPayload, 'requestId'>
  timeout?: number
  matchResponse?: (response: TResult, requestId: string) => boolean
}

const DEFAULT_TIMEOUT = 10000

interface WebSocketResponse {
  requestId?: string
  success?: boolean
  error?: string
}

export async function createWebSocketRequest<TPayload extends { requestId: string }, TResult>(
  config: WebSocketRequestConfig<TPayload, TResult>
): Promise<TResult> {
  const {
    requestEvent,
    responseEvent,
    payload,
    timeout = DEFAULT_TIMEOUT,
    matchResponse
  } = config

  return new Promise<TResult>((resolve, reject) => {
    if (!websocketClient.isSocketConnected()) {
      reject(new Error('WebSocket not connected'))
      return
    }

    const requestId = generateRequestId()
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handleResponse = (response: TResult) => {
      const responseWithBase = response as TResult & WebSocketResponse

      const shouldMatch = matchResponse
        ? matchResponse(response, requestId)
        : responseWithBase.requestId === requestId

      if (!shouldMatch) return

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      websocketClient.off(responseEvent, handleResponse)

      if (responseWithBase.success === false) {
        const error = responseWithBase.error || 'Unknown error'
        reject(new Error(error))
        return
      }

      resolve(response)
    }

    websocketClient.on(responseEvent, handleResponse)

    websocketClient.emit(requestEvent, {
      ...payload,
      requestId
    } as TPayload)

    timeoutId = setTimeout(() => {
      websocketClient.off(responseEvent, handleResponse)
      reject(new Error(`Request timeout: ${requestEvent}`))
    }, timeout)
  })
}
