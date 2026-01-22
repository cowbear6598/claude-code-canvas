import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export function useMobile() {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return {
    isMobile: computed(() => isMobile.value),
  }
}
