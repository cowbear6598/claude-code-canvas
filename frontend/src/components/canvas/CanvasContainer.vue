<script setup lang="ts">
import {ref, computed} from 'vue'
import {usePodStore, useViewportStore, useSelectionStore} from '@/stores/pod'
import {useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore} from '@/stores/note'
import {useConnectionStore} from '@/stores/connectionStore'
import {useDeleteSelection, useNoteEventHandlers} from '@/composables/canvas'
import CanvasViewport from './CanvasViewport.vue'
import EmptyState from './EmptyState.vue'
import PodTypeMenu from './PodTypeMenu.vue'
import CanvasPod from '@/components/pod/CanvasPod.vue'
import GenericNote from './GenericNote.vue'
import TrashZone from './TrashZone.vue'
import ConnectionLayer from './ConnectionLayer.vue'
import SelectionBox from './SelectionBox.vue'
import type {PodTypeConfig} from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

const podStore = usePodStore()
const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const subAgentStore = useSubAgentStore()
const repositoryStore = useRepositoryStore()
const connectionStore = useConnectionStore()

useDeleteSelection()

const trashZoneRef = ref<InstanceType<typeof TrashZone> | null>(null)

const showTrashZone = computed(() => outputStyleStore.isDraggingNote || skillStore.isDraggingNote || subAgentStore.isDraggingNote || repositoryStore.isDraggingNote)
const isTrashHighlighted = computed(() => outputStyleStore.isOverTrash || skillStore.isOverTrash || subAgentStore.isOverTrash || repositoryStore.isOverTrash)

const validateCoordinate = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value
}

const handleDoubleClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  if (
    target.classList.contains('viewport') ||
    target.classList.contains('canvas-content')
  ) {
    podStore.showTypeMenu({ x: e.clientX, y: e.clientY })
  }
}

const handleCanvasClick = (e: MouseEvent) => {
  if (selectionStore.boxSelectJustEnded) {
    return
  }

  const target = e.target as HTMLElement

  if (target.closest('.connection-line')) {
    return
  }

  if (target.closest('.pod-doodle')) {
    return
  }

  if (target.closest('.output-style-note')) {
    return
  }

  if (target.closest('.skill-note')) {
    return
  }

  if (target.closest('.subagent-note')) {
    return
  }

  if (target.closest('.repository-note')) {
    return
  }

  selectionStore.clearSelection()
  connectionStore.selectConnection(null)
}

const handleSelectType = async (config: PodTypeConfig) => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  const rotation = Math.random() * DEFAULT_POD_ROTATION_RANGE - (DEFAULT_POD_ROTATION_RANGE / 2)
  const newPod = {
    name: `Pod ${podStore.podCount + 1}`,
    type: config.type,
    x: canvasX - POD_MENU_X_OFFSET,
    y: canvasY - POD_MENU_Y_OFFSET,
    color: config.color,
    output: [],
    rotation: Math.round(rotation * 10) / 10,
  }

  podStore.hideTypeMenu()

  await podStore.createPodWithBackend(newPod)
}

const handleSelectPod = (podId: string) => {
  podStore.selectPod(podId)
}

const handleDeletePod = async (id: string) => {
  await podStore.deletePodWithBackend(id)
}

const handleDragEnd = (data: { id: string; x: number; y: number }) => {
  podStore.movePod(data.id, data.x, data.y)
}

const handleCreateOutputStyleNote = (outputStyleId: string) => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  outputStyleStore.createNote(outputStyleId, canvasX, canvasY)
}

const handleCreateSkillNote = (skillId: string) => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  skillStore.createNote(skillId, canvasX, canvasY)
}

const handleCreateSubAgentNote = (subAgentId: string) => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  subAgentStore.createNote(subAgentId, canvasX, canvasY)
}

const handleCreateRepositoryNote = (repositoryId: string) => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  repositoryStore.createNote(repositoryId, canvasX, canvasY)
}

const outputStyleHandlers = useNoteEventHandlers({ store: outputStyleStore, trashZoneRef })
const skillHandlers = useNoteEventHandlers({ store: skillStore, trashZoneRef })
const subAgentHandlers = useNoteEventHandlers({ store: subAgentStore, trashZoneRef })
const repositoryHandlers = useNoteEventHandlers({ store: repositoryStore, trashZoneRef })
</script>

<template>
  <CanvasViewport @dblclick="handleDoubleClick" @click="handleCanvasClick">
    <!-- Connection Layer -->
    <ConnectionLayer />

    <!-- Selection Box -->
    <SelectionBox />

    <!-- Pod 列表 -->
    <CanvasPod
      v-for="pod in podStore.pods"
      :key="pod.id"
      :pod="pod"
      @select="handleSelectPod"
      @update="podStore.updatePod"
      @delete="handleDeletePod"
      @drag-end="handleDragEnd"
    />

    <!-- Output Style Notes -->
    <GenericNote
      v-for="note in outputStyleStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      note-type="outputStyle"
      @drag-end="outputStyleHandlers.handleDragEnd"
      @drag-move="outputStyleHandlers.handleDragMove"
      @drag-complete="outputStyleHandlers.handleDragComplete"
    />

    <!-- Skill Notes -->
    <GenericNote
      v-for="note in skillStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      note-type="skill"
      @drag-end="skillHandlers.handleDragEnd"
      @drag-move="skillHandlers.handleDragMove"
      @drag-complete="skillHandlers.handleDragComplete"
    />

    <!-- SubAgent Notes -->
    <GenericNote
      v-for="note in subAgentStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      note-type="subAgent"
      @drag-end="subAgentHandlers.handleDragEnd"
      @drag-move="subAgentHandlers.handleDragMove"
      @drag-complete="subAgentHandlers.handleDragComplete"
    />

    <!-- Repository Notes -->
    <GenericNote
      v-for="note in repositoryStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      note-type="repository"
      @drag-end="repositoryHandlers.handleDragEnd"
      @drag-move="repositoryHandlers.handleDragMove"
      @drag-complete="repositoryHandlers.handleDragComplete"
    />

    <!-- 空狀態 - 在畫布座標中央 -->
    <EmptyState v-if="podStore.podCount === 0" />
  </CanvasViewport>

  <!-- Pod 類型選單 - 放在 transform 容器外面 -->
  <PodTypeMenu
    v-if="podStore.typeMenu.visible && podStore.typeMenu.position"
    :position="podStore.typeMenu.position"
    @select="handleSelectType"
    @create-output-style-note="handleCreateOutputStyleNote"
    @create-skill-note="handleCreateSkillNote"
    @create-subagent-note="handleCreateSubAgentNote"
    @create-repository-note="handleCreateRepositoryNote"
    @close="podStore.hideTypeMenu"
  />

  <!-- Trash Zone -->
  <TrashZone
    ref="trashZoneRef"
    :visible="showTrashZone"
    :is-highlighted="isTrashHighlighted"
  />
</template>
