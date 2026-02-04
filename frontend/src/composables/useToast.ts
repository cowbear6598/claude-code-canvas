import { ref, type Ref } from 'vue'

interface ToastOptions {
  title: string
  description?: string
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: string
}

const toasts = ref<ToastItem[]>([])

export function useToast(): {
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  toasts: Ref<ToastItem[]>
} {
  const toast = ({ title, description, duration = 3000 }: ToastOptions): string => {
    const id = crypto.randomUUID()
    const item: ToastItem = { id, title, description, duration }

    toasts.value.push(item)

    setTimeout(() => {
      dismiss(id)
    }, duration)

    return id
  }

  const dismiss = (id: string): void => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toast,
    dismiss,
    toasts,
  }
}
