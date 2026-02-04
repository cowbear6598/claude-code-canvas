<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { Eraser, Trash2, Timer } from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  podId: string
  podName: string
  isSourcePod: boolean
  showScheduleButton: boolean
  isAutoClearEnabled: boolean
  isAutoClearAnimating: boolean
  isLoadingDownstream: boolean
  isClearing: boolean
  downstreamPods: Array<{ id: string; name: string }>
  showClearDialog: boolean
  showDeleteDialog: boolean
  hasSchedule: boolean
  scheduleEnabled: boolean
  scheduleTooltip: string
}>()

const emit = defineEmits<{
  'delete': []
  'clear-workflow': []
  'toggle-auto-clear': []
  'update:show-clear-dialog': [value: boolean]
  'update:show-delete-dialog': [value: boolean]
  'confirm-clear': []
  'cancel-clear': []
  'confirm-delete': []
  'cancel-delete': []
  'open-schedule-modal': []
}>()

const chatStore = useChatStore()

const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isLongPress = ref(false)
const isToggling = ref(false)
const LONG_PRESS_DURATION = 500

const isLongPressing = ref(false)
const longPressProgress = ref(0)
const mousePosition = ref({ x: 0, y: 0 })
let progressAnimationFrame: number | null = null
let longPressStartTime: number | null = null

const handleEraserMouseDown = (e: MouseEvent): void => {
  e.stopPropagation()
  isLongPress.value = false
  isLongPressing.value = true
  longPressProgress.value = 0
  longPressStartTime = performance.now()

  mousePosition.value = { x: e.clientX, y: e.clientY }

  const updateProgress = (): void => {
    if (!longPressStartTime || !isLongPressing.value) return

    const elapsed = performance.now() - longPressStartTime
    longPressProgress.value = Math.min(elapsed / LONG_PRESS_DURATION, 1)

    if (longPressProgress.value < 1) {
      progressAnimationFrame = requestAnimationFrame(updateProgress)
    }
  }
  progressAnimationFrame = requestAnimationFrame(updateProgress)

  longPressTimer.value = setTimeout(() => {
    isLongPress.value = true
    isLongPressing.value = false
    longPressProgress.value = 0
    emit('toggle-auto-clear')
  }, LONG_PRESS_DURATION)
}

const handleEraserMouseUp = (): void => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  isLongPressing.value = false
  longPressProgress.value = 0
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame)
    progressAnimationFrame = null
  }
  if (!isLongPress.value) {
    emit('clear-workflow')
  }
}

const handleEraserMouseLeave = (): void => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  isLongPressing.value = false
  longPressProgress.value = 0
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame)
    progressAnimationFrame = null
  }
}

const handleDelete = (): void => {
  emit('update:show-delete-dialog', true)
}

const confirmDelete = (): void => {
  emit('confirm-delete')
}

const cancelDelete = (): void => {
  emit('cancel-delete')
}

const confirmClear = (): void => {
  emit('confirm-clear')
}

const cancelClear = (): void => {
  emit('cancel-clear')
}

onUnmounted(() => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  if (progressAnimationFrame) {
    cancelAnimationFrame(progressAnimationFrame)
  }
})

watch(() => props.isAutoClearAnimating, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      chatStore.clearAutoClearAnimation()
    }, 600)
  }
})
</script>

<template>
  <!-- 右下角按鈕區域 -->
  <!-- Source Pod: 顯示按鈕群組 (碼表 + 刪除 + 橡皮擦) -->
  <div
    v-if="isSourcePod"
    class="pod-action-buttons-group"
  >
    <!-- 碼表按鈕（最左） -->
    <button
      v-if="showScheduleButton"
      class="schedule-button"
      :class="{ 'schedule-enabled': scheduleEnabled }"
      :title="hasSchedule ? scheduleTooltip : undefined"
      @click.stop="$emit('open-schedule-modal')"
    >
      <Timer :size="16" />
    </button>
    <!-- 刪除按鈕（中） -->
    <button
      class="pod-delete-button"
      @click.stop="handleDelete"
    >
      <Trash2 :size="16" />
    </button>
    <!-- 橡皮擦按鈕（右） -->
    <button
      class="workflow-clear-button-in-group"
      :class="{
        'auto-clear-enabled': isAutoClearEnabled,
        'auto-clear-animating': isAutoClearAnimating
      }"
      :disabled="isLoadingDownstream || isClearing || isToggling"
      @mousedown="handleEraserMouseDown"
      @mouseup="handleEraserMouseUp"
      @mouseleave="handleEraserMouseLeave"
    >
      <Eraser :size="16" />
      <span
        v-show="isAutoClearEnabled"
        class="auto-clear-badge"
      >A</span>
    </button>
  </div>

  <!-- 非 Source Pod: 顯示碼表 + 刪除按鈕 -->
  <div
    v-else
    class="pod-action-buttons-group"
  >
    <!-- 碼表按鈕（左） -->
    <button
      v-if="showScheduleButton"
      class="schedule-button"
      :class="{ 'schedule-enabled': scheduleEnabled }"
      :title="hasSchedule ? scheduleTooltip : undefined"
      @click.stop="$emit('open-schedule-modal')"
    >
      <Timer :size="16" />
    </button>
    <!-- 刪除按鈕（右） -->
    <button
      class="pod-delete-button"
      @click.stop="handleDelete"
    >
      <Trash2 :size="16" />
    </button>
  </div>

  <!-- Clear Workflow Dialog -->
  <Dialog
    :open="showClearDialog"
    @update:open="(val) => emit('update:show-clear-dialog', val)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>清理 Workflow</DialogTitle>
        <DialogDescription>
          即將清空以下 POD 的所有訊息：
        </DialogDescription>
      </DialogHeader>

      <div class="py-4">
        <ul class="space-y-2">
          <li
            v-for="pod in downstreamPods"
            :key="pod.id"
            class="text-sm font-mono text-foreground"
          >
            • {{ pod.name }}
          </li>
        </ul>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isClearing"
          @click="cancelClear"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          :disabled="isClearing"
          @click="confirmClear"
        >
          {{ isClearing ? '清理中...' : '確認清理' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete Pod Dialog -->
  <Dialog
    :open="showDeleteDialog"
    @update:open="(val) => emit('update:show-delete-dialog', val)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>刪除 Pod</DialogTitle>
        <DialogDescription>
          確定要刪除「{{ podName }}」嗎？此操作無法復原。
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button
          variant="outline"
          @click="cancelDelete"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          @click="confirmDelete"
        >
          確認刪除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Long Press Progress Indicator -->
  <Teleport to="body">
    <div
      v-if="isLongPressing"
      class="long-press-indicator"
      :style="{
        left: mousePosition.x + 'px',
        top: mousePosition.y + 'px'
      }"
    >
      <svg
        class="long-press-ring"
        width="52"
        height="52"
        viewBox="0 0 52 52"
      >
        <!-- 白色甜甜圈底（帶黑色邊框） -->
        <circle
          cx="26"
          cy="26"
          r="20"
          fill="none"
          stroke="var(--card)"
          stroke-width="8"
        />
        <!-- 外邊框 -->
        <circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="var(--doodle-ink)"
          stroke-width="2"
        />
        <!-- 內邊框 -->
        <circle
          cx="26"
          cy="26"
          r="16"
          fill="none"
          stroke="var(--doodle-ink)"
          stroke-width="2"
        />
        <!-- 進度圓 -->
        <circle
          cx="26"
          cy="26"
          r="20"
          fill="none"
          stroke="var(--doodle-blue)"
          stroke-width="6"
          stroke-linecap="round"
          :stroke-dasharray="125.66"
          :stroke-dashoffset="125.66 * (1 - longPressProgress)"
          transform="rotate(-90 26 26)"
        />
      </svg>
    </div>
  </Teleport>
</template>
