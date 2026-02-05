import { useToast } from '@/composables/useToast'
import { sanitizeErrorForUser } from '@/utils/errorSanitizer'

export function useWebSocketErrorHandler(): {
  handleWebSocketError: (error: unknown, title?: string) => void
  wrapWebSocketRequest: <T>(promise: Promise<T>, errorTitle?: string) => Promise<T | null>
} {
  const { toast } = useToast()

  const handleWebSocketError = (error: unknown, title = '操作失敗'): void => {
    const message = sanitizeErrorForUser(error)
    toast({
      title,
      description: message,
      variant: 'destructive'
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
