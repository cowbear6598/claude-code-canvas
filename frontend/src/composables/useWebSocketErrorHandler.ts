import { useToast } from '@/composables/useToast'

export function useWebSocketErrorHandler(): {
  handleWebSocketError: (error: unknown, title?: string) => void
  wrapWebSocketRequest: <T>(promise: Promise<T>, errorTitle?: string) => Promise<T | null>
} {
  const { toast } = useToast()

  const handleWebSocketError = (error: unknown, title = '操作失敗'): void => {
    const message = error instanceof Error ? error.message : '未知錯誤'
    toast({
      title,
      description: message
    })
  }

  const wrapWebSocketRequest = async <T>(
    promise: Promise<T>,
    errorTitle?: string
  ): Promise<T | null> => {
    try {
      return await promise
    } catch (error) {
      handleWebSocketError(error, errorTitle)
      return null
    }
  }

  return {
    handleWebSocketError,
    wrapWebSocketRequest
  }
}
