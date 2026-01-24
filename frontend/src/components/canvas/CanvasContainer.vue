<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import { useSkillStore } from '@/stores/skillStore'
import CanvasViewport from './CanvasViewport.vue'
import Minimap from './Minimap.vue'
import EmptyState from './EmptyState.vue'
import PodTypeMenu from './PodTypeMenu.vue'
import CanvasPod from '@/components/pod/CanvasPod.vue'
import OutputStyleNote from './OutputStyleNote.vue'
import SkillNote from './SkillNote.vue'
import TrashZone from './TrashZone.vue'
import type { PodTypeConfig } from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

const store = useCanvasStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()

const trashZoneRef = ref<InstanceType<typeof TrashZone> | null>(null)

const showTrashZone = computed(() => outputStyleStore.isDraggingNote || skillStore.isDraggingNote)
const isTrashHighlighted = computed(() => outputStyleStore.isOverTrash || skillStore.isOverTrash)

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
    name: `Pod ${store.podCount + 1}`,
    type: config.type,
    x: canvasX - POD_MENU_X_OFFSET,
    y: canvasY - POD_MENU_Y_OFFSET,
    color: config.color,
    output: [],
    rotation: Math.round(rotation * 10) / 10,
  }

  store.hideTypeMenu()

  await store.createPodWithBackend(newPod)
}

const handleSelectPod = (podId: string) => {
  store.selectPod(podId)
}

const handleDeletePod = async (id: string) => {
  await store.deletePodWithBackend(id)
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

const handleCreateSkillNote = (skillId: string) => {
  if (!store.typeMenu.position) return

  const canvasX = validateCoordinate((store.typeMenu.position.x - store.viewport.offset.x) / store.viewport.zoom)
  const canvasY = validateCoordinate((store.typeMenu.position.y - store.viewport.offset.y) / store.viewport.zoom)

  skillStore.createNote(skillId, canvasX, canvasY)
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
      await outputStyleStore.deleteNote(data.noteId)
    } else {
      outputStyleStore.setNoteAnimating(data.noteId, true)
      await outputStyleStore.updateNotePosition(data.noteId, data.startX, data.startY)
      setTimeout(() => {
        outputStyleStore.setNoteAnimating(data.noteId, false)
      }, 300)
    }
  } else {
    await outputStyleStore.updateNotePosition(data.noteId, note.x, note.y)
  }

  outputStyleStore.setIsOverTrash(false)
}

const handleSkillNoteDragEnd = (data: { noteId: string; x: number; y: number }) => {
  skillStore.updateNotePositionLocal(data.noteId, data.x, data.y)
}

const handleSkillNoteDragMove = (data: { noteId: string; screenX: number; screenY: number }) => {
  if (!trashZoneRef.value) return

  const isOver = trashZoneRef.value.isPointInZone(data.screenX, data.screenY)
  skillStore.setIsOverTrash(isOver)
}

const handleSkillNoteDragComplete = async (data: { noteId: string; isOverTrash: boolean; startX: number; startY: number }) => {
  const note = skillStore.getNoteById(data.noteId)
  if (!note) return

  if (data.isOverTrash) {
    if (note.boundToPodId === null) {
      await skillStore.deleteNote(data.noteId)
    } else {
      skillStore.setNoteAnimating(data.noteId, true)
      await skillStore.updateNotePosition(data.noteId, data.startX, data.startY)
      setTimeout(() => {
        skillStore.setNoteAnimating(data.noteId, false)
      }, 300)
    }
  } else {
    await skillStore.updateNotePosition(data.noteId, note.x, note.y)
  }

  skillStore.setIsOverTrash(false)
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

    <!-- Skill Notes -->
    <SkillNote
      v-for="note in skillStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      @drag-end="handleSkillNoteDragEnd"
      @drag-move="handleSkillNoteDragMove"
      @drag-complete="handleSkillNoteDragComplete"
    />

    <!-- 空狀態 - 在畫布座標中央 -->
    <EmptyState v-if="store.podCount === 0" />
  </CanvasViewport>

  <!-- Pod 類型選單 - 放在 transform 容器外面 -->
  <PodTypeMenu
    v-if="store.typeMenu.visible && store.typeMenu.position"
    :position="store.typeMenu.position"
    @select="handleSelectType"
    @create-output-style-note="handleCreateOutputStyleNote"
    @create-skill-note="handleCreateSkillNote"
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
