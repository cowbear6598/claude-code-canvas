<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import CanvasViewport from './CanvasViewport.vue'
import Minimap from './Minimap.vue'
import EmptyState from './EmptyState.vue'
import PodTypeMenu from './PodTypeMenu.vue'
import CanvasPod from '@/components/pod/CanvasPod.vue'
import OutputStyleNote from './OutputStyleNote.vue'
import TrashZone from './TrashZone.vue'
import type { PodTypeConfig } from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

const store = useCanvasStore()
const outputStyleStore = useOutputStyleStore()

const trashZoneRef = ref<InstanceType<typeof TrashZone> | null>(null)

const showTrashZone = computed(() => outputStyleStore.isDraggingNote)
const isTrashHighlighted = computed(() => outputStyleStore.isOverTrash)

const validateCoordinate = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value
}

const handleDoubleClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  // 只在直接點擊畫布時才顯示選單（排除 Pod 元素）
  if (
    target.classList.contains('viewport') ||
    target.classList.contains('canvas-content')
  ) {
    // 選單使用螢幕座標（因為是 position: fixed）
    store.showTypeMenu({ x: e.clientX, y: e.clientY })
  }
}

const handleSelectType = async (config: PodTypeConfig) => {
  if (!store.typeMenu.position) return

  // 將螢幕座標轉換為畫布座標
  // 螢幕座標 -> 視口座標 -> 畫布座標
  const canvasX = validateCoordinate((store.typeMenu.position.x - store.viewport.offset.x) / store.viewport.zoom)
  const canvasY = validateCoordinate((store.typeMenu.position.y - store.viewport.offset.y) / store.viewport.zoom)

  const rotation = Math.random() * DEFAULT_POD_ROTATION_RANGE - (DEFAULT_POD_ROTATION_RANGE / 2)
  const newPod = {
    name: `${config.type.split(' ')[0]} ${store.podCount + 1}`,
    type: config.type,
    x: canvasX - POD_MENU_X_OFFSET,
    y: canvasY - POD_MENU_Y_OFFSET,
    color: config.color,
    output: [],
    rotation: Math.round(rotation * 10) / 10,
  }

  store.hideTypeMenu()

  try {
    // Create pod via backend
    await store.createPodWithBackend(newPod)
  } catch (error) {
    console.error('[CanvasContainer] Failed to create pod:', error)
    // TODO: Show error notification to user
  }
}

const handleSelectPod = (podId: string) => {
  store.selectPod(podId)
}

const handleDeletePod = async (id: string) => {
  try {
    // Delete pod via backend
    await store.deletePodWithBackend(id)
  } catch (error) {
    console.error('[CanvasContainer] Failed to delete pod:', error)
    // TODO: Show error notification to user
  }
}

const handleDragEnd = (data: { id: string; x: number; y: number }) => {
  store.movePod(data.id, data.x, data.y)
}

const handleCreateOutputStyleNote = (outputStyleId: string) => {
  if (!store.typeMenu.position) return

  const canvasX = validateCoordinate((store.typeMenu.position.x - store.viewport.offset.x) / store.viewport.zoom)
  const canvasY = validateCoordinate((store.typeMenu.position.y - store.viewport.offset.y) / store.viewport.zoom)

  outputStyleStore.createNote(outputStyleId, canvasX, canvasY)
}

// 拖拽過程中只更新本地狀態，不發 WebSocket
const handleNoteDragEnd = (data: { noteId: string; x: number; y: number }) => {
  outputStyleStore.updateNotePositionLocal(data.noteId, data.x, data.y)
}

const handleNoteDragMove = (data: { noteId: string; screenX: number; screenY: number }) => {
  if (!trashZoneRef.value) return

  const isOver = trashZoneRef.value.isPointInZone(data.screenX, data.screenY)
  outputStyleStore.setIsOverTrash(isOver)
}

const handleNoteDragComplete = async (data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }) => {
  const note = outputStyleStore.getNoteById(data.noteId)
  if (!note) return

  if (data.isOverTrash) {
    if (note.boundToPodId === null) {
      // 刪除 Note
      try {
        await outputStyleStore.deleteNote(data.noteId)
      } catch (error) {
        console.error('[CanvasContainer] Failed to delete note:', error)
      }
    } else {
      // 已綁定的 Note 回到原位
      outputStyleStore.setNoteAnimating(data.noteId, true)
      await outputStyleStore.updateNotePosition(data.noteId, data.startX, data.startY)
      setTimeout(() => {
        outputStyleStore.setNoteAnimating(data.noteId, false)
      }, 300)
    }
  } else {
    // 正常拖拽結束，同步最終位置到後端
    try {
      await outputStyleStore.updateNotePosition(data.noteId, note.x, note.y)
    } catch (error) {
      console.error('[CanvasContainer] Failed to sync note position:', error)
    }
  }

  outputStyleStore.setIsOverTrash(false)
}
</script>

<template>
  <CanvasViewport @dblclick="handleDoubleClick">
    <!-- Pod 列表 -->
    <CanvasPod
      v-for="pod in store.pods"
      :key="pod.id"
      :pod="pod"
      @select="handleSelectPod"
      @update="store.updatePod"
      @delete="handleDeletePod"
      @drag-end="handleDragEnd"
    />

    <!-- Output Style Notes -->
    <OutputStyleNote
      v-for="note in outputStyleStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      @drag-end="handleNoteDragEnd"
      @drag-move="handleNoteDragMove"
      @drag-complete="handleNoteDragComplete"
    />

    <!-- 空狀態 -->
    <EmptyState v-if="store.podCount === 0" />
  </CanvasViewport>

  <!-- Pod 類型選單 - 放在 transform 容器外面 -->
  <PodTypeMenu
    v-if="store.typeMenu.visible && store.typeMenu.position"
    :position="store.typeMenu.position"
    @select="handleSelectType"
    @create-output-style-note="handleCreateOutputStyleNote"
    @close="store.hideTypeMenu"
  />

  <!-- Trash Zone -->
  <TrashZone
    ref="trashZoneRef"
    :visible="showTrashZone"
    :is-highlighted="isTrashHighlighted"
  />

  <!-- Minimap -->
  <Minimap />
</template>
