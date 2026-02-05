import { computed, type Ref, type ComputedRef } from 'vue'
import { HEADER_HEIGHT } from '@/lib/constants'

interface MenuDirection {
  vertical: 'down' | 'up'
}

interface UseMenuPositionOptions {
  position: Ref<{ x: number; y: number }> | { x: number; y: number }
}

interface UseMenuPositionReturn {
  menuStyle: ComputedRef<Record<string, string>>
}

export function useMenuPosition(options: UseMenuPositionOptions): UseMenuPositionReturn {
  const direction = computed<MenuDirection>(() => {
    const pos = 'value' in options.position ? options.position.value : options.position
    const availableHeight = window.innerHeight - HEADER_HEIGHT

    const vertical: MenuDirection['vertical'] = pos.y > HEADER_HEIGHT + availableHeight / 3 ? 'up' : 'down'

    return { vertical }
  })

  const menuStyle = computed(() => {
    const pos = 'value' in options.position ? options.position.value : options.position
    const base: Record<string, string> = {
      transform: 'scale(0.8)',
    }

    base.left = `${pos.x}px`

    if (direction.value.vertical === 'down') {
      base.top = `${pos.y}px`
      base.transformOrigin = 'top left'
    } else {
      base.bottom = `${window.innerHeight - pos.y}px`
      base.transformOrigin = 'bottom left'
    }

    base.boxShadow = '3px 3px 0 var(--doodle-ink)'

    return base
  })

  return { menuStyle }
}
