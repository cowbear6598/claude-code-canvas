<script setup lang="ts">
import {computed, onUnmounted, ref} from 'vue'
import {useCanvasContext} from '@/composables/canvas/useCanvasContext'
import {useDeleteSelection, useGitCloneProgress, useNoteEventHandlers} from '@/composables/canvas'
import {isCtrlOrCmdPressed} from '@/utils/keyboardHelpers'
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
import CreateRepositoryModal from './CreateRepositoryModal.vue'
import CloneRepositoryModal from './CloneRepositoryModal.vue'
import ConfirmDeleteModal from './ConfirmDeleteModal.vue'
import CreateEditModal from './CreateEditModal.vue'
import type {Pod, PodTypeConfig, Position} from '@/types'
import {
  POD_MENU_X_OFFSET,
  POD_MENU_Y_OFFSET,
  DEFAULT_POD_ROTATION_RANGE,
} from '@/lib/constants'

type ItemType = 'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command'
type ResourceType = 'outputStyle' | 'subAgent' | 'command'
type GroupType = 'outputStyleGroup' | 'subAgentGroup' | 'commandGroup'
type ExtendedResourceType = ResourceType | GroupType
type ExtendedItemType = ItemType | GroupType

interface DeleteTarget {
  type: ExtendedItemType
  id: string
  name: string
}

interface EditModalState {
  visible: boolean
  mode: 'create' | 'edit'
  title: string
  initialName: string
  initialContent: string
  resourceType: ExtendedResourceType
  itemId: string
  showContent: boolean
}

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
  isWorktree: boolean
}>({
  visible: false,
  position: {x: 0, y: 0},
  repositoryId: '',
  repositoryName: '',
  notePosition: {x: 0, y: 0},
  isWorktree: false
})

const showCreateRepositoryModal = ref(false)
const showCloneRepositoryModal = ref(false)
const showDeleteModal = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)
const lastMenuPosition = ref<Position | null>(null)

const editModal = ref<EditModalState>({
  visible: false,
  mode: 'create',
  title: '',
  initialName: '',
  initialContent: '',
  resourceType: 'outputStyle',
  itemId: '',
  showContent: true
})

const isDeleteTargetInUse = computed(() => {
  if (!deleteTarget.value) return false

  const {type, id} = deleteTarget.value

  const inUseChecks: Record<ExtendedItemType, () => boolean> = {
    outputStyle: (): boolean => outputStyleStore.isItemInUse(id),
    skill: (): boolean => skillStore.isItemInUse(id),
    subAgent: (): boolean => subAgentStore.isItemInUse(id),
    repository: (): boolean => repositoryStore.isItemInUse(id),
    command: (): boolean => commandStore.isItemInUse(id),
    outputStyleGroup: (): boolean => false,
    subAgentGroup: (): boolean => false,
    commandGroup: (): boolean => false,
  }

  return inUseChecks[type]()
})

/**
 * 檢查所有 Store 是否有任何屬性為 true
 * @param property - Store 屬性名稱（例如 'isDraggingNote' 或 'isOverTrash'）
 * @returns 是否有任何 Store 的該屬性為 true
 */
const checkAnyStoreProperty = (property: 'isDraggingNote' | 'isOverTrash'): boolean => {
  const stores = [outputStyleStore, skillStore, subAgentStore, repositoryStore, commandStore]
  return stores.some(store => store[property])
}

const showTrashZone = computed(() => checkAnyStoreProperty('isDraggingNote'))
const isTrashHighlighted = computed(() => checkAnyStoreProperty('isOverTrash'))

const isCanvasEmpty = computed(() =>
    podStore.podCount === 0 &&
    outputStyleStore.notes.length === 0 &&
    skillStore.notes.length === 0 &&
    subAgentStore.notes.length === 0 &&
    repositoryStore.notes.length === 0 &&
    commandStore.notes.length === 0
)

const resourceTitleMap = {
  outputStyle: 'Output Style',
  subAgent: 'SubAgent',
  command: 'Command'
} as const

const readActions: Record<ResourceType, (id: string) => Promise<{
  id: string;
  name: string;
  content: string
} | null>> = {
  outputStyle: (id) => outputStyleStore.readOutputStyle(id),
  subAgent: (id) => subAgentStore.readSubAgent(id),
  command: (id) => commandStore.readCommand(id)
}

const CANVAS_COORDINATE_MIN = -100000
const CANVAS_COORDINATE_MAX = 100000

/**
 * 驗證並限制座標值在有效範圍內
 * @param value - 原始座標值
 * @returns 有效的座標值（限制在 -100000 ~ 100000 之間）
 */
const validateCoordinate = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(CANVAS_COORDINATE_MIN, Math.min(CANVAS_COORDINATE_MAX, value))
}

/**
 * 將螢幕座標轉換為畫布座標
 * @param screenPos - 螢幕座標（例如滑鼠點擊位置）
 * @returns 畫布座標（考慮 offset 和 zoom）
 */
const screenToCanvasPosition = (screenPos: Position): Position => {
  return {
    x: validateCoordinate((screenPos.x - viewportStore.offset.x) / viewportStore.zoom),
    y: validateCoordinate((screenPos.y - viewportStore.offset.y) / viewportStore.zoom)
  }
}

const handleContextMenu = (e: MouseEvent): void => {
  e.preventDefault() // 防止瀏覽器預設右鍵選單
  const target = e.target as HTMLElement

  if (
      target.classList.contains('viewport') ||
      target.classList.contains('canvas-content')
  ) {
    podStore.showTypeMenu({x: e.clientX, y: e.clientY})
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

const outputStyleHandlers = useNoteEventHandlers({store: outputStyleStore, trashZoneRef})
const skillHandlers = useNoteEventHandlers({store: skillStore, trashZoneRef})
const subAgentHandlers = useNoteEventHandlers({store: subAgentStore, trashZoneRef})
const repositoryHandlers = useNoteEventHandlers({store: repositoryStore, trashZoneRef})
const commandHandlers = useNoteEventHandlers({store: commandStore, trashZoneRef})

const getRepositoryBranchName = (repositoryId: string): string | undefined => {
  const repository = repositoryStore.availableItems.find(r => r.id === repositoryId)
  return repository?.currentBranch || repository?.branchName
}

const handleRepositoryContextMenu = (data: { noteId: string; event: MouseEvent }): void => {
  const note = repositoryStore.notes.find(n => n.id === data.noteId)
  if (!note) return

  const repository = repositoryStore.availableItems.find(r => r.id === note.repositoryId)
  if (!repository) return

  repositoryContextMenu.value = {
    visible: true,
    position: {x: data.event.clientX, y: data.event.clientY},
    repositoryId: repository.id,
    repositoryName: repository.name,
    notePosition: {x: note.x, y: note.y},
    isWorktree: !!repository.parentRepoId
  }
}

const handleRepositoryContextMenuClose = (): void => {
  repositoryContextMenu.value.visible = false
}

const handleCloneStarted = (payload: { requestId: string; repoName: string }): void => {
  gitCloneProgress.addTask(payload.requestId, payload.repoName)
}

const handleOpenCreateModal = (resourceType: ResourceType, title: string): void => {
  lastMenuPosition.value = podStore.typeMenu.position
  editModal.value = {
    visible: true,
    mode: 'create',
    title,
    initialName: '',
    initialContent: '',
    resourceType,
    itemId: '',
    showContent: true
  }
}

const handleOpenCreateGroupModal = (groupType: GroupType, title: string): void => {
  lastMenuPosition.value = podStore.typeMenu.position
  editModal.value = {
    visible: true,
    mode: 'create',
    title,
    initialName: '',
    initialContent: '',
    resourceType: groupType,
    itemId: '',
    showContent: false
  }
}

const handleOpenEditModal = async (resourceType: ResourceType, id: string): Promise<void> => {
  lastMenuPosition.value = podStore.typeMenu.position

  const data = await readActions[resourceType](id)

  if (!data) {
    console.error(`無法讀取 ${resourceTitleMap[resourceType]} (id: ${id})，請確認後端是否正常運作`)
    return
  }

  editModal.value = {
    visible: true,
    mode: 'edit',
    title: `編輯 ${resourceTitleMap[resourceType]}`,
    initialName: data.name,
    initialContent: data.content,
    resourceType,
    itemId: id,
    showContent: true
  }
}

const handleOpenDeleteModal = (type: ItemType, id: string, name: string): void => {
  deleteTarget.value = {type, id, name}
  showDeleteModal.value = true
}

const handleOpenDeleteGroupModal = (groupType: GroupType, groupId: string, name: string): void => {
  deleteTarget.value = {type: groupType, id: groupId, name}
  showDeleteModal.value = true
}

const handleOpenCreateRepositoryModal = (): void => {
  lastMenuPosition.value = podStore.typeMenu.position
  showCreateRepositoryModal.value = true
}

const handleOpenCloneRepositoryModal = (): void => {
  showCloneRepositoryModal.value = true
}

const handleDeleteConfirm = async (): Promise<void> => {
  if (!deleteTarget.value) return

  const {type, id} = deleteTarget.value

  const deleteActions: Record<ExtendedItemType, () => Promise<void | { success: boolean; error?: string }>> = {
    outputStyle: (): Promise<void> => outputStyleStore.deleteOutputStyle(id),
    skill: (): Promise<void> => skillStore.deleteSkill(id),
    subAgent: (): Promise<void> => subAgentStore.deleteSubAgent(id),
    repository: (): Promise<void> => repositoryStore.deleteRepository(id),
    command: (): Promise<void> => commandStore.deleteCommand(id),
    outputStyleGroup: () => outputStyleStore.deleteOutputStyleGroup(id),
    subAgentGroup: () => subAgentStore.deleteSubAgentGroup(id),
    commandGroup: () => commandStore.deleteCommandGroup(id),
  }

  const result = await deleteActions[type]()

  // 如果是 group 刪除且失敗（有項目），顯示錯誤
  if (result && typeof result === 'object' && !result.success) {
    console.error('刪除失敗:', result.error)
    // 保持 modal 開啟讓使用者知道失敗
    return
  }

  showDeleteModal.value = false
  deleteTarget.value = null
}

const handleCreateEditSubmit = async (payload: { name: string; content: string }): Promise<void> => {
  const {name, content} = payload
  const {mode, resourceType, itemId} = editModal.value

  if (mode === 'create') {
    const createActions: Record<ExtendedResourceType, () => Promise<void>> = {
      outputStyle: async (): Promise<void> => {
        const result = await outputStyleStore.createOutputStyle(name, content)
        if (result.success && result.outputStyle && lastMenuPosition.value) {
          const {x, y} = screenToCanvasPosition(lastMenuPosition.value)
          await outputStyleStore.createNote(result.outputStyle.id, x, y)
        }
      },
      subAgent: async (): Promise<void> => {
        const result = await subAgentStore.createSubAgent(name, content)
        if (result.success && result.subAgent && lastMenuPosition.value) {
          const {x, y} = screenToCanvasPosition(lastMenuPosition.value)
          await subAgentStore.createNote(result.subAgent.id, x, y)
        }
      },
      command: async (): Promise<void> => {
        const result = await commandStore.createCommand(name, content)
        if (result.success && result.command && lastMenuPosition.value) {
          const {x, y} = screenToCanvasPosition(lastMenuPosition.value)
          await commandStore.createNote(result.command.id, x, y)
        }
      },
      outputStyleGroup: async (): Promise<void> => {
        await outputStyleStore.createOutputStyleGroup(name)
      },
      subAgentGroup: async (): Promise<void> => {
        await subAgentStore.createSubAgentGroup(name)
      },
      commandGroup: async (): Promise<void> => {
        await commandStore.createCommandGroup(name)
      }
    }

    await createActions[resourceType]()
  } else {
    const updateActions: Partial<Record<ExtendedResourceType, () => Promise<unknown>>> = {
      outputStyle: () => outputStyleStore.updateOutputStyle(itemId, content),
      subAgent: () => subAgentStore.updateSubAgent(itemId, content),
      command: () => commandStore.updateCommand(itemId, content)
    }

    const action = updateActions[resourceType]
    if (action) {
      await action()
    }
  }

  editModal.value.visible = false
}

const handleRepositoryCreated = (repository: { id: string; name: string }): void => {
  if (!lastMenuPosition.value) return

  const {x, y} = screenToCanvasPosition(lastMenuPosition.value)

  repositoryStore.createNote(repository.id, x, y)
}

/**
 * 處理 Note 雙擊事件
 * 根據不同類型的 Note 取得對應的資源 ID，並開啟編輯 Modal
 * 只處理可編輯的 Note 類型（outputStyle、subAgent、command）
 */
const handleNoteDoubleClick = (data: {
  noteId: string;
  noteType: 'outputStyle' | 'skill' | 'subAgent' | 'repository' | 'command'
}): void => {
  const {noteId, noteType} = data

  // 只處理可編輯的類型
  if (noteType !== 'outputStyle' && noteType !== 'subAgent' && noteType !== 'command') {
    return
  }

  let resourceId: string | undefined

  switch (noteType) {
    case 'outputStyle': {
      const note = outputStyleStore.notes.find(n => n.id === noteId)
      resourceId = note?.outputStyleId
      break
    }
    case 'subAgent': {
      const note = subAgentStore.notes.find(n => n.id === noteId)
      resourceId = note?.subAgentId
      break
    }
    case 'command': {
      const note = commandStore.notes.find(n => n.id === noteId)
      resourceId = note?.commandId
      break
    }
  }

  if (resourceId) {
    handleOpenEditModal(noteType, resourceId)
  } else {
    console.error(`無法找到 Note (id: ${noteId}, type: ${noteType}) 的資源 ID`)
  }
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
    <ConnectionLayer/>

    <!-- Selection Box -->
    <SelectionBox/>

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
        @dblclick="handleNoteDoubleClick"
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
        @dblclick="handleNoteDoubleClick"
    />

    <!-- Repository Notes -->
    <GenericNote
        v-for="note in repositoryStore.getUnboundNotes"
        :key="note.id"
        :note="note"
        note-type="repository"
        :branch-name="getRepositoryBranchName(note.repositoryId)"
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
        @dblclick="handleNoteDoubleClick"
    />

    <!-- 空狀態 - 在畫布座標中央 -->
    <EmptyState v-if="isCanvasEmpty"/>
  </CanvasViewport>

  <!-- Clone Progress Panel - Fixed at bottom-right corner -->
  <CloneProgressNote :tasks="gitCloneProgress.cloneTasks.value"/>

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
      @open-create-modal="handleOpenCreateModal"
      @open-create-group-modal="handleOpenCreateGroupModal"
      @open-edit-modal="handleOpenEditModal"
      @open-delete-modal="handleOpenDeleteModal"
      @open-delete-group-modal="handleOpenDeleteGroupModal"
      @open-create-repository-modal="handleOpenCreateRepositoryModal"
      @open-clone-repository-modal="handleOpenCloneRepositoryModal"
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
      :is-worktree="repositoryContextMenu.isWorktree"
      @close="handleRepositoryContextMenuClose"
      @worktree-created="handleRepositoryContextMenuClose"
  />

  <!-- Modals -->
  <CreateRepositoryModal
      v-model:open="showCreateRepositoryModal"
      @created="handleRepositoryCreated"
  />

  <CloneRepositoryModal
      v-model:open="showCloneRepositoryModal"
      @clone-started="handleCloneStarted"
  />

  <ConfirmDeleteModal
      v-model:open="showDeleteModal"
      :item-name="deleteTarget?.name ?? ''"
      :is-in-use="isDeleteTargetInUse"
      :item-type="deleteTarget?.type ?? 'outputStyle'"
      @confirm="handleDeleteConfirm"
  />

  <CreateEditModal
      v-model:open="editModal.visible"
      :mode="editModal.mode"
      :title="editModal.title"
      :initial-name="editModal.initialName"
      :initial-content="editModal.initialContent"
      :name-editable="editModal.mode === 'create'"
      :show-content="editModal.showContent"
      @submit="handleCreateEditSubmit"
  />
</template>
