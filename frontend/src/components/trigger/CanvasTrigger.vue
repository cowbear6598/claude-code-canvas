<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Clock, Trash2, Pencil, Power } from 'lucide-vue-next'
import type { Trigger } from '@/types/trigger'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useAnchorDetection } from '@/composables/useAnchorDetection'
import { useBatchDrag } from '@/composables/canvas'
import { isCtrlOrCmdPressed } from '@/utils/keyboardHelpers'
import TriggerAnchor from './TriggerAnchor.vue'

const props = defineProps<{
  trigger: Trigger
}>()

const emit = defineEmits<{
  select: [triggerId: string]
  delete: [id: string]
  'drag-end': [data: { id: string; x: number; y: number }]
}>()

const {
  triggerStore,
  viewportStore,
  selectionStore,
  podStore,
  connectionStore
} = useCanvasContext()
const { detectTargetAnchor } = useAnchorDetection()
const { startBatchDrag, isElementSelected } = useBatchDrag()

const isDragging = ref(false)
const dragRef = ref<{
  startX: number
  startY: number
  triggerX: number
  triggerY: number
} | null>(null)

const isSelected = computed(() =>
  selectionStore.selectedElements.some(el => el.type === 'trigger' && el.id === props.trigger.id)
)

const isFiring = computed(() => triggerStore.isTriggerFiring(props.trigger.id))

const frequencySummary = computed(() => {
  const config = props.trigger.config
  const weekdayNames = ['一', '二', '三', '四', '五', '六', '日']

  switch (config.frequency) {
    case 'every-second':
      return `每${config.second}秒`
    case 'every-x-minute':
      return `每${config.intervalMinute}分`
    case 'every-x-hour':
      return `每${config.intervalHour}小時`
    case 'every-day':
      return `每天 ${config.hour}:${String(config.minute).padStart(2, '0')}`
    case 'every-week': {
      const weekdaysText = config.weekdays
        .sort((a, b) => a - b)
        .map(d => weekdayNames[d])
        .join(',')
      return `每週${weekdaysText} ${config.hour}:${String(config.minute).padStart(2, '0')}`
    }
    default:
      return ''
  }
})

const lastTriggeredText = computed(() => {
  if (!props.trigger.lastTriggeredAt) return null

  const date = new Date(props.trigger.lastTriggeredAt)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  if (isToday) {
    return `上次 ${hours}:${minutes}`
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `上次 ${month}/${day} ${hours}:${minutes}`
  }
})

let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null

const cleanupEventListeners = (): void => {
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler)
    currentMouseMoveHandler = null
  }
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
}

onUnmounted(() => {
  cleanupEventListeners()
})

const handleMouseDown = (e: MouseEvent): void => {
  if (isCtrlOrCmdPressed(e)) {
    selectionStore.toggleElement({ type: 'trigger', id: props.trigger.id })
    connectionStore.selectConnection(null)
    return
  }

  if (isElementSelected('trigger', props.trigger.id)) {
    if (startBatchDrag(e)) {
      return
    }
  }

  if (!isElementSelected('trigger', props.trigger.id)) {
    selectionStore.setSelectedElements([{ type: 'trigger', id: props.trigger.id }])
  }

  connectionStore.selectConnection(null)

  cleanupEventListeners()

  isDragging.value = true
  dragRef.value = {
    startX: e.clientX,
    startY: e.clientY,
    triggerX: props.trigger.x,
    triggerY: props.trigger.y,
  }

  const handleMouseMove = (moveEvent: MouseEvent): void => {
    if (!dragRef.value) return

    const dx = (moveEvent.clientX - dragRef.value.startX) / viewportStore.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / viewportStore.zoom

    emit('drag-end', {
      id: props.trigger.id,
      x: dragRef.value.triggerX + dx,
      y: dragRef.value.triggerY + dy,
    })
  }

  const handleMouseUp = async (): Promise<void> => {
    isDragging.value = false

    if (dragRef.value) {
      const dx = (dragRef.value.startX - dragRef.value.startX) / viewportStore.zoom
      const dy = (dragRef.value.startY - dragRef.value.startY) / viewportStore.zoom

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        await triggerStore.updateTrigger(props.trigger.id, {
          x: props.trigger.x,
          y: props.trigger.y
        })
      }
    }

    dragRef.value = null
    cleanupEventListeners()
  }

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleDblClick = (): void => {
  if (isDragging.value) return
  triggerStore.setEditingTrigger(props.trigger.id)
}

const handleDelete = (): void => {
  emit('delete', props.trigger.id)
}

const handleEdit = (): void => {
  triggerStore.setEditingTrigger(props.trigger.id)
}

const handleToggleEnabled = (): void => {
  triggerStore.toggleTriggerEnabled(props.trigger.id)
}

const handleAnchorDragStart = (data: {
  triggerId: string
  anchor: 'right'
  screenX: number
  screenY: number
}): void => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.startDragging(
    null,
    data.anchor,
    { x: canvasX, y: canvasY },
    'trigger',
    data.triggerId
  )
}

const handleAnchorDragMove = (data: { screenX: number; screenY: number }): void => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.updateDraggingPosition({ x: canvasX, y: canvasY })
}

const handleAnchorDragEnd = async (): Promise<void> => {
  if (!connectionStore.draggingConnection) {
    connectionStore.endDragging()
    return
  }

  const { sourceAnchor, currentPoint, sourceTriggerId } = connectionStore.draggingConnection

  const targetAnchor = detectTargetAnchor(currentPoint, podStore.pods, '')

  if (targetAnchor && sourceTriggerId) {
    await connectionStore.createConnection(
      null,
      sourceAnchor,
      targetAnchor.podId,
      targetAnchor.anchor,
      'trigger',
      sourceTriggerId
    )
  }

  connectionStore.endDragging()
}
</script>

<template>
  <div
    class="absolute select-none"
    :style="{
      left: `${trigger.x}px`,
      top: `${trigger.y}px`,
      zIndex: 10,
    }"
    @mousedown="handleMouseDown"
  >
    <div
      class="relative"
      :style="{ transform: `rotate(${trigger.rotation}deg)` }"
    >
      <!-- Chevron 形狀容器 -->
      <div
        :class="[
          'trigger-chevron',
          {
            selected: isSelected,
            'trigger-disabled': !trigger.enabled,
            'trigger-firing': isFiring
          }
        ]"
        @dblclick="handleDblClick"
      >
        <!-- SVG 背景與邊框 -->
        <svg
          class="absolute inset-0 pointer-events-none"
          width="120"
          height="70"
          viewBox="0 0 120 70"
        >
          <!-- 陰影 -->
          <path
            d="M 2,2 L 92,2 L 122,37 L 92,72 L 2,72 Z"
            class="trigger-chevron-shadow"
          />
          <!-- 背景 -->
          <path
            d="M 0,0 L 90,0 L 120,35 L 90,70 L 0,70 Z"
            class="trigger-chevron-bg"
          />
          <!-- 邊框 -->
          <path
            d="M 0,0 L 90,0 L 120,35 L 90,70 L 0,70 Z"
            class="trigger-chevron-border"
          />
        </svg>

        <!-- 內容區域 -->
        <div class="trigger-content">
          <Clock
            :size="18"
            :stroke-width="2.5"
            style="color: oklch(0.3 0.03 60); flex-shrink: 0;"
          />
          <div class="trigger-text-container">
            <div class="trigger-name">
              {{ trigger.name }}
            </div>
            <div class="trigger-summary">
              {{ frequencySummary }}
            </div>
            <div
              v-if="lastTriggeredText"
              class="trigger-last-fired"
            >
              {{ lastTriggeredText }}
            </div>
          </div>
        </div>

        <!-- 錨點 -->
        <TriggerAnchor
          :trigger-id="trigger.id"
          @drag-start="handleAnchorDragStart"
          @drag-move="handleAnchorDragMove"
          @drag-end="handleAnchorDragEnd"
        />
      </div>

      <!-- 操作按鈕 -->
      <div
        v-if="isSelected"
        class="trigger-action-buttons-group"
        :style="{
          transform: `rotate(-${trigger.rotation}deg)`,
          transformOrigin: 'top left'
        }"
      >
        <button
          :class="[
            'trigger-action-button trigger-toggle-button',
            trigger.enabled ? 'enabled' : 'disabled'
          ]"
          @click.stop="handleToggleEnabled"
        >
          <Power :size="12" />
        </button>
        <button
          class="trigger-action-button trigger-edit-button"
          @click.stop="handleEdit"
        >
          <Pencil :size="12" />
        </button>
        <button
          class="trigger-action-button trigger-delete-button"
          @click.stop="handleDelete"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>
