<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useDeleteSelection, useNoteEventHandlers, useGitCloneProgress } from '@/composables/canvas'
import { isCtrlOrCmdPressed } from '@/utils/keyboardHelpers'
import CanvasViewport from './CanvasViewport.vue'
import EmptyState from './EmptyState.vue'
import PodTypeMenu from './PodTypeMenu.vue'
import CanvasPod from '@/components/pod/CanvasPod.vue'
import GenericNote from './GenericNote.vue'
import CloneProgressNote from './CloneProgressNote.vue'
import TrashZone from './TrashZone.vue'
import ConnectionLayer from './ConnectionLayer.vue'
import SelectionBox from './SelectionBox.vue'
import RepositoryContextMenu from './RepositoryContextMenu.vue'
import type {Pod, PodTypeConfig} from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

const {
  podStore,
  viewportStore,
  selectionStore,
  outputStyleStore,
  skillStore,
  subAgentStore,
  repositoryStore,
  commandStore,
  connectionStore
} = useCanvasContext()

useDeleteSelection()

const gitCloneProgress = useGitCloneProgress()

const trashZoneRef = ref<InstanceType<typeof TrashZone> | null>(null)

const repositoryContextMenu = ref<{
  visible: boolean
  position: { x: number; y: number }
  repositoryId: string
  repositoryName: string
  notePosition: { x: number; y: number }
}>({
  visible: false,
  position: { x: 0, y: 0 },
  repositoryId: '',
  repositoryName: '',
  notePosition: { x: 0, y: 0 }
})

const showTrashZone = computed(() => outputStyleStore.isDraggingNote || skillStore.isDraggingNote || subAgentStore.isDraggingNote || repositoryStore.isDraggingNote || commandStore.isDraggingNote)
const isTrashHighlighted = computed(() => outputStyleStore.isOverTrash || skillStore.isOverTrash || subAgentStore.isOverTrash || repositoryStore.isOverTrash || commandStore.isOverTrash)

const isCanvasEmpty = computed(() =>
  podStore.podCount === 0 &&
  outputStyleStore.notes.length === 0 &&
  skillStore.notes.length === 0 &&
  subAgentStore.notes.length === 0 &&
  repositoryStore.notes.length === 0 &&
  commandStore.notes.length === 0
)

const validateCoordinate = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return value
}

const handleContextMenu = (e: MouseEvent): void => {
  e.preventDefault() // 防止瀏覽器預設右鍵選單
  const target = e.target as HTMLElement

  if (
    target.classList.contains('viewport') ||
    target.classList.contains('canvas-content')
  ) {
    podStore.showTypeMenu({ x: e.clientX, y: e.clientY })
  }
}

const handleCanvasClick = (e: MouseEvent): void => {
  if (selectionStore.boxSelectJustEnded) {
    return
  }

  const target = e.target as HTMLElement

  const ignoredSelectors = [
    '.connection-line',
    '.pod-doodle',
    '.output-style-note',
    '.skill-note',
    '.subagent-note',
    '.repository-note',
    '.command-note'
  ]
  if (ignoredSelectors.some(s => target.closest(s))) {
    return
  }

  if (isCtrlOrCmdPressed(e)) {
    return
  }

  selectionStore.clearSelection()
  connectionStore.selectConnection(null)
}

const handleSelectType = async (config: PodTypeConfig): Promise<void> => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  const rotation = Math.random() * DEFAULT_POD_ROTATION_RANGE - (DEFAULT_POD_ROTATION_RANGE / 2)
  const newPod = {
    name: `Pod ${podStore.podCount + 1}`,
    x: canvasX - POD_MENU_X_OFFSET,
    y: canvasY - POD_MENU_Y_OFFSET,
    color: config.color,
    output: [],
    rotation: Math.round(rotation * 10) / 10,
  }

  podStore.hideTypeMenu()

  await podStore.createPodWithBackend(newPod)
}

const handleSelectPod = (podId: string): void => {
  podStore.selectPod(podId)
}

const handleUpdatePod = async (pod: Pod): Promise<void> => {
  const oldPod = podStore.getPodById(pod.id)
  if (!oldPod) return

  podStore.updatePod(pod)

  if (oldPod.name !== pod.name) {
    await podStore.renamePodWithBackend(pod.id, pod.name)
  }
}

const handleDeletePod = async (id: string): Promise<void> => {
  await podStore.deletePodWithBackend(id)
}

const handleDragEnd = (data: { id: string; x: number; y: number }): void => {
  podStore.movePod(data.id, data.x, data.y)
}

const handlePodDragComplete = (data: { id: string }): void => {
  podStore.syncPodPosition(data.id)
}

const handleCreateOutputStyleNote = (outputStyleId: string): void => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  outputStyleStore.createNote(outputStyleId, canvasX, canvasY)
}

const handleCreateSkillNote = (skillId: string): void => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  skillStore.createNote(skillId, canvasX, canvasY)
}

const handleCreateSubAgentNote = (subAgentId: string): void => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  subAgentStore.createNote(subAgentId, canvasX, canvasY)
}

const handleCreateRepositoryNote = (repositoryId: string): void => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  repositoryStore.createNote(repositoryId, canvasX, canvasY)
}

const handleCreateCommandNote = (commandId: string): void => {
  if (!podStore.typeMenu.position) return

  const canvasX = validateCoordinate((podStore.typeMenu.position.x - viewportStore.offset.x) / viewportStore.zoom)
  const canvasY = validateCoordinate((podStore.typeMenu.position.y - viewportStore.offset.y) / viewportStore.zoom)

  commandStore.createNote(commandId, canvasX, canvasY)
}

const outputStyleHandlers = useNoteEventHandlers({ store: outputStyleStore, trashZoneRef })
const skillHandlers = useNoteEventHandlers({ store: skillStore, trashZoneRef })
const subAgentHandlers = useNoteEventHandlers({ store: subAgentStore, trashZoneRef })
const repositoryHandlers = useNoteEventHandlers({ store: repositoryStore, trashZoneRef })
const commandHandlers = useNoteEventHandlers({ store: commandStore, trashZoneRef })

const handleRepositoryContextMenu = (data: { noteId: string; event: MouseEvent }): void => {
  const note = repositoryStore.notes.find(n => n.id === data.noteId)
  if (!note) return

  const repository = repositoryStore.availableItems.find(r => r.id === note.repositoryId)
  if (!repository) return

  repositoryContextMenu.value = {
    visible: true,
    position: { x: data.event.clientX, y: data.event.clientY },
    repositoryId: repository.id,
    repositoryName: repository.name,
    notePosition: { x: note.x, y: note.y }
  }
}

const handleRepositoryContextMenuClose = (): void => {
  repositoryContextMenu.value.visible = false
}

const handleCloneStarted = (payload: { requestId: string; repoName: string }): void => {
  gitCloneProgress.addTask(payload.requestId, payload.repoName)
}

onUnmounted(() => {
  gitCloneProgress.cleanupListeners()
})
</script>

<template>
  <CanvasViewport
    @contextmenu="handleContextMenu"
    @click="handleCanvasClick"
  >
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
      @update="handleUpdatePod"
      @delete="handleDeletePod"
      @drag-end="handleDragEnd"
      @drag-complete="handlePodDragComplete"
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
      @contextmenu="handleRepositoryContextMenu"
    />

    <!-- Command Notes -->
    <GenericNote
      v-for="note in commandStore.getUnboundNotes"
      :key="note.id"
      :note="note"
      note-type="command"
      @drag-end="commandHandlers.handleDragEnd"
      @drag-move="commandHandlers.handleDragMove"
      @drag-complete="commandHandlers.handleDragComplete"
    />

    <!-- 空狀態 - 在畫布座標中央 -->
    <EmptyState v-if="isCanvasEmpty" />
  </CanvasViewport>

  <!-- Clone Progress Panel - Fixed at bottom-right corner -->
  <CloneProgressNote :tasks="gitCloneProgress.cloneTasks.value" />

  <!-- Pod 類型選單 - 放在 transform 容器外面 -->
  <PodTypeMenu
    v-if="podStore.typeMenu.visible && podStore.typeMenu.position"
    :position="podStore.typeMenu.position"
    @select="handleSelectType"
    @create-output-style-note="handleCreateOutputStyleNote"
    @create-skill-note="handleCreateSkillNote"
    @create-subagent-note="handleCreateSubAgentNote"
    @create-repository-note="handleCreateRepositoryNote"
    @create-command-note="handleCreateCommandNote"
    @clone-started="handleCloneStarted"
    @close="podStore.hideTypeMenu"
  />

  <!-- Trash Zone -->
  <TrashZone
    ref="trashZoneRef"
    :visible="showTrashZone"
    :is-highlighted="isTrashHighlighted"
  />

  <!-- Repository Context Menu -->
  <RepositoryContextMenu
    v-if="repositoryContextMenu.visible"
    :position="repositoryContextMenu.position"
    :repository-id="repositoryContextMenu.repositoryId"
    :repository-name="repositoryContextMenu.repositoryName"
    :note-position="repositoryContextMenu.notePosition"
    @close="handleRepositoryContextMenuClose"
    @worktree-created="handleRepositoryContextMenuClose"
  />
</template>
