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

export interface PendingRequest<T = unknown> {
  requestId: string
  resolve: (data: T) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
  responseEvent: string
  timestamp: number
}

const pendingRequests = new Map<string, PendingRequest>()

export function addPendingRequest<T>(
  requestId: string,
  resolve: (data: T) => void,
  reject: (error: Error) => void,
  timeout: number,
  responseEvent: string
): void {
  const timeoutId = setTimeout(() => {
    removePendingRequest(requestId)
    reject(new Error(`Request timeout: ${responseEvent}`))
  }, timeout)

  pendingRequests.set(requestId, {
    requestId,
    resolve: resolve as (data: unknown) => void,
    reject,
    timeoutId,
    responseEvent,
    timestamp: Date.now()
  })
}

export function removePendingRequest(requestId: string): void {
  const request = pendingRequests.get(requestId)
  if (request) {
    clearTimeout(request.timeoutId)
    pendingRequests.delete(requestId)
  }
}

export function tryResolvePendingRequest(requestId: string, data: unknown): boolean {
  const request = pendingRequests.get(requestId)
  if (request) {
    clearTimeout(request.timeoutId)
    pendingRequests.delete(requestId)
    request.resolve(data)
    return true
  }
  return false
}

export function tryRejectPendingRequest(requestId: string, error: Error): boolean {
  const request = pendingRequests.get(requestId)
  if (request) {
    clearTimeout(request.timeoutId)
    pendingRequests.delete(requestId)
    request.reject(error)
    return true
  }
  return false
}

export function hasPendingRequest(requestId: string): boolean {
  return pendingRequests.has(requestId)
}

export function clearAllPendingRequests(reason: string): void {
  const error = new Error(reason)
  for (const request of pendingRequests.values()) {
    clearTimeout(request.timeoutId)
    request.reject(error)
  }
  pendingRequests.clear()
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
    if (!websocketClient.isConnected.value) {
      reject(new Error('WebSocket not connected'))
      return
    }

    const requestId = generateRequestId()
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const handleResponse = (response: TResult): void => {
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
