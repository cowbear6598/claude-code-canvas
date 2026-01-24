<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { Pod } from '@/types'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import PodHeader from './PodHeader.vue'
import PodMiniScreen from './PodMiniScreen.vue'
import PodStickyTab from './PodStickyTab.vue'
import PodOutputStyleSlot from './PodOutputStyleSlot.vue'

const props = defineProps<{
  pod: Pod
}>()

const canvasStore = useCanvasStore()
const outputStyleStore = useOutputStyleStore()

const isActive = computed(() => props.pod.id === canvasStore.activePodId)
const boundNote = computed(() => outputStyleStore.getNoteByPodId(props.pod.id))

const emit = defineEmits<{
  select: [podId: string]
  update: [pod: Pod]
  delete: [id: string]
  'drag-end': [data: { id: string; x: number; y: number }]
}>()

const isTabOpen = ref(false)
const isDragging = ref(false)
const isEditing = ref(false)
const dragRef = ref<{
  startX: number
  startY: number
  podX: number
  podY: number
} | null>(null)

// 在 script setup 中添加用於追蹤當前事件監聽器的變數
let currentMouseMoveHandler: ((e: MouseEvent) => void) | null = null
let currentMouseUpHandler: (() => void) | null = null

// 清理函數
const cleanupEventListeners = () => {
  if (currentMouseMoveHandler) {
    document.removeEventListener('mousemove', currentMouseMoveHandler)
    currentMouseMoveHandler = null
  }
  if (currentMouseUpHandler) {
    document.removeEventListener('mouseup', currentMouseUpHandler)
    currentMouseUpHandler = null
  }
}

// 在組件卸載時清理
onUnmounted(() => {
  cleanupEventListeners()
})

const handleMouseDown = (e: MouseEvent) => {
  // 排除特定區域的拖拽
  if (
    (e.target as HTMLElement).closest('.sticky-tab-area') ||
    (e.target as HTMLElement).closest('.mini-screen-click') ||
    (e.target as HTMLElement).closest('.pod-output-style-slot')
  ) {
    return
  }

  canvasStore.setActivePod(props.pod.id)

  // 先清理之前可能存在的監聽器
  cleanupEventListeners()

  isDragging.value = true
  dragRef.value = {
    startX: e.clientX,
    startY: e.clientY,
    podX: props.pod.x,
    podY: props.pod.y,
  }

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!dragRef.value) return
    const dx = (moveEvent.clientX - dragRef.value.startX) / canvasStore.viewport.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / canvasStore.viewport.zoom
    emit('drag-end', {
      id: props.pod.id,
      x: dragRef.value.podX + dx,
      y: dragRef.value.podY + dy,
    })
  }

  const handleMouseUp = () => {
    isDragging.value = false
    dragRef.value = null
    cleanupEventListeners()
  }

  // 保存引用以便清理
  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleToggleTab = () => {
  canvasStore.setActivePod(props.pod.id)
  isTabOpen.value = !isTabOpen.value
}

const handleRename = () => {
  isEditing.value = true
  isTabOpen.value = false
}

const handleUpdateName = (name: string) => {
  emit('update', { ...props.pod, name })
}

const handleSaveName = () => {
  isEditing.value = false
}

const handleCopy = async () => {
  // 消毒 output 內容
  const sanitizedOutput = props.pod.output
    .map(line => line.replace(/[\x00-\x1F\x7F]/g, '')) // 移除控制字元
    .join('\n')
    .slice(0, 10000) // 限制總長度

  try {
    await navigator.clipboard.writeText(sanitizedOutput)
  } catch (err) {
    // 降級方案
    const textArea = document.createElement('textarea')
    textArea.value = sanitizedOutput
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

const handleDelete = () => {
  emit('delete', props.pod.id)
}

const handleSelectPod = () => {
  canvasStore.setActivePod(props.pod.id)
  emit('select', props.pod.id)
}

const handleNoteDropped = async (noteId: string) => {
  console.log('[CanvasPod] Note dropped:', noteId, 'to pod:', props.pod.id)
  try {
    await outputStyleStore.bindToPod(noteId, props.pod.id)
    const note = outputStyleStore.getNoteById(noteId)
    console.log('[CanvasPod] Bind success, note:', note)
    if (note) {
      canvasStore.updatePodOutputStyle(props.pod.id, note.outputStyleId)
    }
  } catch (error) {
    console.error('[CanvasPod] Failed to bind output style:', error)
  }
}

const handleNoteRemoved = async () => {
  try {
    await outputStyleStore.unbindFromPod(props.pod.id, true)
    canvasStore.updatePodOutputStyle(props.pod.id, null)
  } catch (error) {
    console.error('[CanvasPod] Failed to unbind output style:', error)
  }
}
</script>

<template>
  <div
    class="absolute select-none"
    :style="{
      left: `${pod.x}px`,
      top: `${pod.y}px`,
      zIndex: isActive ? 100 : 10,
    }"
    @mousedown="handleMouseDown"
  >
    <!-- Pod 主卡片和標籤（都在旋轉容器內） -->
    <div
      class="relative"
      :style="{ transform: `rotate(${pod.rotation}deg)` }"
    >
      <!-- Output Style Slot -->
      <div class="absolute -top-10 left-2">
        <PodOutputStyleSlot
          :pod-id="pod.id"
          :bound-note="boundNote"
          @note-dropped="handleNoteDropped"
          @note-removed="handleNoteRemoved"
        />
      </div>

      <!-- 粘性標籤 -->
      <PodStickyTab
        :color="pod.color"
        :is-open="isTabOpen"
        @toggle="handleToggleTab"
        @rename="handleRename"
        @copy="handleCopy"
        @delete="handleDelete"
      />

      <!-- Pod 主卡片 -->
      <div class="pod-doodle w-56 overflow-visible relative">
        <div class="p-3">
          <!-- 標題 -->
          <PodHeader
            :name="pod.name"
            :type="pod.type"
            :color="pod.color"
            :is-editing="isEditing"
            @update:name="handleUpdateName"
            @save="handleSaveName"
          />

          <!-- 迷你螢幕 -->
          <PodMiniScreen :output="pod.output" @dblclick="handleSelectPod" />
        </div>
      </div>
    </div>
  </div>
</template>
