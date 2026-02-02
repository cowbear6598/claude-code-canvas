<script setup lang="ts">
import {ref, computed, onUnmounted} from 'vue'
import type {Pod, ModelType} from '@/types'
import type {AnchorPosition} from '@/types/connection'
import {useCanvasContext} from '@/composables/canvas/useCanvasContext'
import {useAnchorDetection} from '@/composables/useAnchorDetection'
import {useBatchDrag} from '@/composables/canvas'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {useToast} from '@/composables/useToast'
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

const {
  podStore,
  viewportStore,
  selectionStore,
  outputStyleStore,
  skillStore,
  subAgentStore,
  repositoryStore,
  commandStore,
  connectionStore,
  chatStore,
  canvasStore
} = useCanvasContext()
const {detectTargetAnchor} = useAnchorDetection()
const {toast} = useToast()
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
  'drag-complete': [data: { id: string }]
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
    selectionStore.toggleElement({type: 'pod', id: props.pod.id})
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
    selectionStore.setSelectedElements([{type: 'pod', id: props.pod.id}])
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
    emit('drag-complete', { id: props.pod.id })

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

const handleDblClick = (e: MouseEvent): void => {
  if (isEditing.value || isDragging.value) return

  const target = e.target as HTMLElement

  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  handleSelectPod()
}

type NoteType = 'outputStyle' | 'skill' | 'subAgent' | 'repository' | 'command'

interface NoteStoreMapping {
  bindToPod: (noteId: string, podId: string) => Promise<void>
  getNoteById: (noteId: string) => any
  isItemBoundToPod?: (itemId: string, podId: string) => boolean
  unbindFromPod?: (podId: string, returnToOriginal: boolean) => Promise<void>
  getItemId: (note: any) => string
  updatePodField?: (podId: string, itemId: string | null) => void
}

const noteStoreMap: Record<NoteType, NoteStoreMapping> = {
  outputStyle: {
    bindToPod: (noteId, podId) => outputStyleStore.bindToPod(noteId, podId),
    getNoteById: (noteId) => outputStyleStore.getNoteById(noteId),
    unbindFromPod: (podId, returnToOriginal) => outputStyleStore.unbindFromPod(podId, returnToOriginal),
    getItemId: (note) => note.outputStyleId,
    updatePodField: (podId, itemId) => podStore.updatePodOutputStyle(podId, itemId)
  },
  skill: {
    bindToPod: (noteId, podId) => skillStore.bindToPod(noteId, podId),
    getNoteById: (noteId) => skillStore.getNoteById(noteId),
    isItemBoundToPod: (itemId, podId) => skillStore.isItemBoundToPod(itemId, podId),
    getItemId: (note) => note.skillId
  },
  subAgent: {
    bindToPod: (noteId, podId) => subAgentStore.bindToPod(noteId, podId),
    getNoteById: (noteId) => subAgentStore.getNoteById(noteId),
    isItemBoundToPod: (itemId, podId) => subAgentStore.isItemBoundToPod(itemId, podId),
    getItemId: (note) => note.subAgentId
  },
  repository: {
    bindToPod: (noteId, podId) => repositoryStore.bindToPod(noteId, podId),
    getNoteById: (noteId) => repositoryStore.getNoteById(noteId),
    unbindFromPod: (podId, returnToOriginal) => repositoryStore.unbindFromPod(podId, returnToOriginal),
    getItemId: (note) => note.repositoryId,
    updatePodField: (podId, itemId) => podStore.updatePodRepository(podId, itemId)
  },
  command: {
    bindToPod: (noteId, podId) => commandStore.bindToPod(noteId, podId),
    getNoteById: (noteId) => commandStore.getNoteById(noteId),
    unbindFromPod: (podId, returnToOriginal) => commandStore.unbindFromPod(podId, returnToOriginal),
    getItemId: (note) => note.commandId,
    updatePodField: (podId, itemId) => podStore.updatePodCommand(podId, itemId)
  }
}

const handleNoteDrop = async (noteType: NoteType, noteId: string): Promise<void> => {
  const mapping = noteStoreMap[noteType]
  const note = mapping.getNoteById(noteId)
  if (!note) return

  if (mapping.isItemBoundToPod) {
    const itemId = mapping.getItemId(note)
    if (mapping.isItemBoundToPod(itemId, props.pod.id)) {
      if (noteType === 'skill') {
        toast({title: '已存在，無法插入', description: '此 Skill 已綁定到此 Pod', duration: 3000})
      } else if (noteType === 'subAgent') {
        toast({title: '已存在，無法插入', description: '此 SubAgent 已綁定到此 Pod', duration: 3000})
      }
      return
    }
  }

  await mapping.bindToPod(noteId, props.pod.id)

  if (mapping.updatePodField) {
    const itemId = mapping.getItemId(note)
    mapping.updatePodField(props.pod.id, itemId)
  }
}

const handleNoteRemove = async (noteType: NoteType): Promise<void> => {
  const mapping = noteStoreMap[noteType]
  if (!mapping.unbindFromPod) return

  await mapping.unbindFromPod(props.pod.id, true)

  if (mapping.updatePodField) {
    mapping.updatePodField(props.pod.id, null)
  }
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
        targetAnchor.anchor,
        'pod'
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
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          sourcePodId: props.pod.id
        }
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
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          sourcePodId: props.pod.id
        }
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
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          podId: props.pod.id,
          model
        }
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
          @output-style-dropped="(noteId) => handleNoteDrop('outputStyle', noteId)"
          @output-style-removed="() => handleNoteRemove('outputStyle')"
          @skill-dropped="(noteId) => handleNoteDrop('skill', noteId)"
          @subagent-dropped="(noteId) => handleNoteDrop('subAgent', noteId)"
          @repository-dropped="(noteId) => handleNoteDrop('repository', noteId)"
          @repository-removed="() => handleNoteRemove('repository')"
          @command-dropped="(noteId) => handleNoteDrop('command', noteId)"
          @command-removed="() => handleNoteRemove('command')"
      />

      <!-- Pod 主卡片 (增加凹槽偽元素) -->
      <div
          class="pod-doodle w-56 overflow-visible relative"
          :class="[podStatusClass, { selected: isSelected }]"
          @dblclick="handleDblClick"
      >
        <!-- Model 凹槽 -->
        <div class="model-notch"/>
        <!-- SubAgent 凹槽 -->
        <div class="subagent-notch"/>
        <!-- Repository 凹槽（右側） -->
        <div class="repository-notch"/>
        <!-- Command 凹槽（右側） -->
        <div class="command-notch"/>

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
              :color="pod.color"
              :is-editing="isEditing"
              @update:name="handleUpdateName"
              @save="handleSaveName"
              @rename="handleRename"
          />

          <!-- 迷你螢幕 -->
          <PodMiniScreen
              :output="pod.output"
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
