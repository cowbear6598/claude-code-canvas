<script setup lang="ts">
import {ref, computed, onUnmounted} from 'vue'
import type {Pod, ModelType} from '@/types'
import type {AnchorPosition} from '@/types/connection'
import {usePodStore, useViewportStore, useSelectionStore} from '@/stores/pod'
import {useOutputStyleStore, useSkillStore, useRepositoryStore, useSubAgentStore, useCommandStore} from '@/stores/note'
import {useConnectionStore} from '@/stores/connectionStore'
import {useChatStore} from '@/stores/chat'
import {useAnchorDetection} from '@/composables/useAnchorDetection'
import {useBatchDrag} from '@/composables/canvas'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {isCtrlOrCmdPressed} from '@/utils/keyboardHelpers'
import {createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import type {
  WorkflowGetDownstreamPodsResultPayload,
  WorkflowClearResultPayload,
  PodUpdatedPayload,
  WorkflowGetDownstreamPodsPayload,
  WorkflowClearPayload,
  PodUpdatePayload
} from '@/types/websocket'
import PodHeader from '@/components/pod/PodHeader.vue'
import PodMiniScreen from '@/components/pod/PodMiniScreen.vue'
import PodSlots from '@/components/pod/PodSlots.vue'
import PodAnchors from '@/components/pod/PodAnchors.vue'
import PodActions from '@/components/pod/PodActions.vue'
import PodModelSelector from '@/components/pod/PodModelSelector.vue'

const props = defineProps<{
  pod: Pod
}>()

const podStore = usePodStore()
const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const subAgentStore = useSubAgentStore()
const repositoryStore = useRepositoryStore()
const commandStore = useCommandStore()
const connectionStore = useConnectionStore()
const chatStore = useChatStore()
const {detectTargetAnchor} = useAnchorDetection()
const {startBatchDrag, isElementSelected} = useBatchDrag()

const isActive = computed(() => props.pod.id === podStore.activePodId)
const boundNote = computed(() => outputStyleStore.getNotesByPodId(props.pod.id)[0])
const boundSkillNotes = computed(() => skillStore.getNotesByPodId(props.pod.id))
const boundSubAgentNotes = computed(() => subAgentStore.getNotesByPodId(props.pod.id))
const boundRepositoryNote = computed(() => repositoryStore.getNotesByPodId(props.pod.id)[0])
const boundCommandNote = computed(() => commandStore.getNotesByPodId(props.pod.id)[0])
const isSourcePod = computed(() => connectionStore.isSourcePod(props.pod.id))
const currentModel = computed(() => props.pod.model ?? 'opus')

const isSelected = computed(() =>
    selectionStore.selectedPodIds.includes(props.pod.id)
)

const podStatusClass = computed(() => {
  return props.pod.status ? `pod-status-${props.pod.status}` : ''
})

const emit = defineEmits<{
  select: [podId: string]
  update: [pod: Pod]
  delete: [id: string]
  'drag-end': [data: { id: string; x: number; y: number }]
}>()

const isDragging = ref(false)
const isEditing = ref(false)
const dragRef = ref<{
  startX: number
  startY: number
  podX: number
  podY: number
} | null>(null)

const showClearDialog = ref(false)
const downstreamPods = ref<Array<{ id: string; name: string }>>([])
const isLoadingDownstream = ref(false)
const isClearing = ref(false)
const showDeleteDialog = ref(false)

const isAutoClearEnabled = computed(() => props.pod.autoClear ?? false)
const isAutoClearAnimating = computed(() => chatStore.autoClearAnimationPodId === props.pod.id)

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
  const slotClasses = [
    '.pod-output-style-slot',
    '.pod-skill-slot',
    '.pod-subagent-slot',
    '.pod-repository-slot',
    '.pod-command-slot'
  ]
  const target = e.target as HTMLElement
  if (slotClasses.some(cls => target.closest(cls))) {
    return
  }

  if (isCtrlOrCmdPressed(e)) {
    selectionStore.toggleElement({ type: 'pod', id: props.pod.id })
    podStore.setActivePod(props.pod.id)
    connectionStore.selectConnection(null)
    return
  }

  if (isElementSelected('pod', props.pod.id)) {
    if (startBatchDrag(e)) {
      return
    }
  }

  if (!isElementSelected('pod', props.pod.id)) {
    selectionStore.setSelectedElements([{ type: 'pod', id: props.pod.id }])
  }

  podStore.setActivePod(props.pod.id)

  connectionStore.selectConnection(null)

  cleanupEventListeners()

  isDragging.value = true
  dragRef.value = {
    startX: e.clientX,
    startY: e.clientY,
    podX: props.pod.x,
    podY: props.pod.y,
  }

  const handleMouseMove = (moveEvent: MouseEvent): void => {
    if (!dragRef.value) return

    const dx = (moveEvent.clientX - dragRef.value.startX) / viewportStore.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / viewportStore.zoom

    emit('drag-end', {
      id: props.pod.id,
      x: dragRef.value.podX + dx,
      y: dragRef.value.podY + dy,
    })
  }

  const handleMouseUp = (): void => {
    isDragging.value = false
    dragRef.value = null
    cleanupEventListeners()
  }

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleRename = (): void => {
  isEditing.value = true
}

const handleUpdateName = (name: string): void => {
  emit('update', {...props.pod, name})
}

const handleSaveName = (): void => {
  isEditing.value = false
}

const handleDelete = (): void => {
  emit('delete', props.pod.id)
  showDeleteDialog.value = false
}

const handleSelectPod = (): void => {
  podStore.setActivePod(props.pod.id)
  emit('select', props.pod.id)
}

const handleNoteDropped = async (noteId: string): Promise<void> => {
  await outputStyleStore.bindToPod(noteId, props.pod.id)
  const note = outputStyleStore.getNoteById(noteId)
  if (note) {
    podStore.updatePodOutputStyle(props.pod.id, note.outputStyleId)
  }
}

const handleNoteRemoved = async (): Promise<void> => {
  await outputStyleStore.unbindFromPod(props.pod.id, true)
  podStore.updatePodOutputStyle(props.pod.id, null)
}

const handleSkillNoteDropped = async (noteId: string): Promise<void> => {
  const note = skillStore.getNoteById(noteId)
  if (!note) return

  if (skillStore.isItemBoundToPod(note.skillId, props.pod.id)) return

  await skillStore.bindToPod(noteId, props.pod.id)
}

const handleSubAgentNoteDropped = async (noteId: string): Promise<void> => {
  const note = subAgentStore.getNoteById(noteId)
  if (!note) return

  if (subAgentStore.isItemBoundToPod(note.subAgentId, props.pod.id)) return

  await subAgentStore.bindToPod(noteId, props.pod.id)
}

const handleRepositoryNoteDropped = async (noteId: string): Promise<void> => {
  await repositoryStore.bindToPod(noteId, props.pod.id)
  const note = repositoryStore.getNoteById(noteId)
  if (note) {
    podStore.updatePodRepository(props.pod.id, note.repositoryId)
  }
}

const handleRepositoryNoteRemoved = async (): Promise<void> => {
  await repositoryStore.unbindFromPod(props.pod.id, true)
  podStore.updatePodRepository(props.pod.id, null)
}

const handleCommandNoteDropped = async (noteId: string): Promise<void> => {
  await commandStore.bindToPod(noteId, props.pod.id)
  const note = commandStore.getNoteById(noteId)
  if (note) {
    podStore.updatePodCommand(props.pod.id, note.commandId)
  }
}

const handleCommandNoteRemoved = async (): Promise<void> => {
  await commandStore.unbindFromPod(props.pod.id, true)
  podStore.updatePodCommand(props.pod.id, null)
}

const handleAnchorDragStart = (data: {
  podId: string
  anchor: AnchorPosition
  screenX: number
  screenY: number
}): void => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.startDragging(data.podId, data.anchor, {x: canvasX, y: canvasY})
}

const handleAnchorDragMove = (data: { screenX: number; screenY: number }): void => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.updateDraggingPosition({x: canvasX, y: canvasY})
}

const handleAnchorDragEnd = async (): Promise<void> => {
  if (!connectionStore.draggingConnection) {
    connectionStore.endDragging()
    return
  }

  const {sourcePodId, sourceAnchor, currentPoint} = connectionStore.draggingConnection

  const targetAnchor = detectTargetAnchor(currentPoint, podStore.pods, sourcePodId)

  if (targetAnchor) {
    await connectionStore.createConnection(
        sourcePodId,
        sourceAnchor,
        targetAnchor.podId,
        targetAnchor.anchor
    )
  }

  connectionStore.endDragging()
}

const handleClearWorkflow = async (): Promise<void> => {
  isLoadingDownstream.value = true

  const {wrapWebSocketRequest} = useWebSocketErrorHandler()

  const response = await wrapWebSocketRequest(
      createWebSocketRequest<WorkflowGetDownstreamPodsPayload, WorkflowGetDownstreamPodsResultPayload>({
        requestEvent: WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        responseEvent: WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        payload: {sourcePodId: props.pod.id}
      }),
      '取得下游 Pod 失敗'
  )

  isLoadingDownstream.value = false

  if (!response) return

  if (!response.pods) return

  downstreamPods.value = response.pods
  showClearDialog.value = true
}

const handleConfirmClear = async (): Promise<void> => {
  isClearing.value = true

  const {wrapWebSocketRequest} = useWebSocketErrorHandler()

  const response = await wrapWebSocketRequest(
      createWebSocketRequest<WorkflowClearPayload, WorkflowClearResultPayload>({
        requestEvent: WebSocketRequestEvents.WORKFLOW_CLEAR,
        responseEvent: WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        payload: {sourcePodId: props.pod.id}
      }),
      '清理 Workflow 失敗'
  )

  isClearing.value = false

  if (!response) return

  if (!response.clearedPodIds) return

  chatStore.clearMessagesByPodIds(response.clearedPodIds)
  podStore.clearPodOutputsByIds(response.clearedPodIds)
  showClearDialog.value = false
  downstreamPods.value = []
}

const handleCancelClear = (): void => {
  showClearDialog.value = false
  downstreamPods.value = []
}

const handleModelChange = async (model: ModelType): Promise<void> => {
  const {wrapWebSocketRequest} = useWebSocketErrorHandler()

  const response = await wrapWebSocketRequest(
      createWebSocketRequest<PodUpdatePayload, PodUpdatedPayload>({
        requestEvent: WebSocketRequestEvents.POD_UPDATE,
        responseEvent: WebSocketResponseEvents.POD_UPDATED,
        payload: {podId: props.pod.id, model}
      }),
      '更新模型失敗'
  )

  if (!response) return

  if (!response.pod) return

  podStore.updatePodModel(props.pod.id, response.pod.model ?? 'opus')
}

const handleToggleAutoClear = async (): Promise<void> => {
  await podStore.setAutoClearWithBackend(props.pod.id, !isAutoClearEnabled.value)
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
      class="relative pod-with-notch pod-with-skill-notch pod-with-subagent-notch pod-with-model-notch pod-with-repository-notch"
      :style="{ transform: `rotate(${pod.rotation}deg)` }"
    >
      <!-- Model Selector -->
      <PodModelSelector
        :pod-id="pod.id"
        :current-model="currentModel"
        @update:model="handleModelChange"
      />

      <!-- Slots -->
      <PodSlots
        :pod-id="pod.id"
        :pod-rotation="pod.rotation"
        :bound-output-style-note="boundNote"
        :bound-skill-notes="boundSkillNotes"
        :bound-sub-agent-notes="boundSubAgentNotes"
        :bound-repository-note="boundRepositoryNote"
        :bound-command-note="boundCommandNote"
        @output-style-dropped="handleNoteDropped"
        @output-style-removed="handleNoteRemoved"
        @skill-dropped="handleSkillNoteDropped"
        @subagent-dropped="handleSubAgentNoteDropped"
        @repository-dropped="handleRepositoryNoteDropped"
        @repository-removed="handleRepositoryNoteRemoved"
        @command-dropped="handleCommandNoteDropped"
        @command-removed="handleCommandNoteRemoved"
      />

      <!-- Pod 主卡片 (增加凹槽偽元素) -->
      <div
        class="pod-doodle w-56 overflow-visible relative"
        :class="[podStatusClass, { selected: isSelected }]"
      >
        <!-- Model 凹槽 -->
        <div class="model-notch" />
        <!-- SubAgent 凹槽 -->
        <div class="subagent-notch" />
        <!-- Repository 凹槽（右側） -->
        <div class="repository-notch" />
        <!-- Command 凹槽（右側） -->
        <div class="command-notch" />

        <!-- Anchors -->
        <PodAnchors
          :pod-id="pod.id"
          @drag-start="handleAnchorDragStart"
          @drag-move="handleAnchorDragMove"
          @drag-end="handleAnchorDragEnd"
        />

        <div class="p-3">
          <!-- 標題 -->
          <PodHeader
            :name="pod.name"
            :type="pod.type"
            :color="pod.color"
            :is-editing="isEditing"
            @update:name="handleUpdateName"
            @save="handleSaveName"
            @rename="handleRename"
          />

          <!-- 迷你螢幕 -->
          <PodMiniScreen
            :output="pod.output"
            @dblclick="handleSelectPod"
          />
        </div>
      </div>

      <!-- Actions -->
      <PodActions
        :pod-id="pod.id"
        :pod-name="pod.name"
        :is-source-pod="isSourcePod"
        :is-auto-clear-enabled="isAutoClearEnabled"
        :is-auto-clear-animating="isAutoClearAnimating"
        :is-loading-downstream="isLoadingDownstream"
        :is-clearing="isClearing"
        :downstream-pods="downstreamPods"
        :show-clear-dialog="showClearDialog"
        :show-delete-dialog="showDeleteDialog"
        @update:show-clear-dialog="showClearDialog = $event"
        @update:show-delete-dialog="showDeleteDialog = $event"
        @delete="handleDelete"
        @clear-workflow="handleClearWorkflow"
        @toggle-auto-clear="handleToggleAutoClear"
        @confirm-clear="handleConfirmClear"
        @cancel-clear="handleCancelClear"
        @confirm-delete="handleDelete"
        @cancel-delete="showDeleteDialog = false"
      />
    </div>
  </div>
</template>
