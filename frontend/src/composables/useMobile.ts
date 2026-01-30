import { computed, type ComputedRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export function useMobile(): {
  isMobile: ComputedRef<boolean>
} {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return {
    isMobile: computed(() => isMobile.value),
  }
}
