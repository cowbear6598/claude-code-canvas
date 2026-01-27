<script setup lang="ts">
import {ref, computed, onUnmounted} from 'vue'
import type {Pod, ModelType} from '@/types'
import type {AnchorPosition} from '@/types/connection'
import {usePodStore, useViewportStore, useSelectionStore} from '@/stores/pod'
import {useOutputStyleStore, useSkillStore, useRepositoryStore} from '@/stores/note'
import {useConnectionStore} from '@/stores/connectionStore'
import {useChatStore} from '@/stores/chatStore'
import {useAnchorDetection} from '@/composables/useAnchorDetection'
import {useBatchDrag} from '@/composables/canvas'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {createWebSocketRequest, WebSocketRequestEvents, WebSocketResponseEvents} from '@/services/websocket'
import type {
  WorkflowGetDownstreamPodsResultPayload,
  WorkflowClearResultPayload,
  PodUpdatedPayload,
  WorkflowGetDownstreamPodsPayload,
  WorkflowClearPayload,
  PodUpdatePayload
} from '@/types/websocket'
import PodHeader from './PodHeader.vue'
import PodMiniScreen from './PodMiniScreen.vue'
import PodOutputStyleSlot from './PodOutputStyleSlot.vue'
import PodSkillSlot from './PodSkillSlot.vue'
import PodRepositorySlot from './PodRepositorySlot.vue'
import PodAnchor from './PodAnchor.vue'
import PodModelSelector from './PodModelSelector.vue'
import {Eraser, Trash2} from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'

const props = defineProps<{
  pod: Pod
}>()

const podStore = usePodStore()
const viewportStore = useViewportStore()
const selectionStore = useSelectionStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const repositoryStore = useRepositoryStore()
const connectionStore = useConnectionStore()
const chatStore = useChatStore()
const {detectTargetAnchor} = useAnchorDetection()
const {startBatchDrag, isElementSelected} = useBatchDrag()

const isActive = computed(() => props.pod.id === podStore.activePodId)
const boundNote = computed(() => outputStyleStore.getNoteByPodId(props.pod.id))
const boundSkillNotes = computed(() => skillStore.getNotesByPodId(props.pod.id))
const boundRepositoryNote = computed(() => repositoryStore.getNoteByPodId(props.pod.id))
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
  'drag-end': [data: {id: string; x: number; y: number}]
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
  if (
    (e.target as HTMLElement).closest('.pod-output-style-slot') ||
    (e.target as HTMLElement).closest('.pod-skill-slot') ||
    (e.target as HTMLElement).closest('.pod-repository-slot')
  ) {
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

  // 取消 connection 選取
  connectionStore.selectConnection(null)

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

    const dx = (moveEvent.clientX - dragRef.value.startX) / viewportStore.zoom
    const dy = (moveEvent.clientY - dragRef.value.startY) / viewportStore.zoom

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

  currentMouseMoveHandler = handleMouseMove
  currentMouseUpHandler = handleMouseUp

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleRename = () => {
  isEditing.value = true
}

const handleUpdateName = (name: string) => {
  emit('update', {...props.pod, name})
}

const handleSaveName = () => {
  isEditing.value = false
}

const handleDelete = () => {
  showDeleteDialog.value = true
}

const confirmDelete = () => {
  emit('delete', props.pod.id)
  showDeleteDialog.value = false
}

const cancelDelete = () => {
  showDeleteDialog.value = false
}

const handleSelectPod = () => {
  podStore.setActivePod(props.pod.id)
  emit('select', props.pod.id)
}

const handleNoteDropped = async (noteId: string) => {
  await outputStyleStore.bindToPod(noteId, props.pod.id)
  const note = outputStyleStore.getNoteById(noteId)
  if (note) {
    podStore.updatePodOutputStyle(props.pod.id, note.outputStyleId)
  }
}

const handleNoteRemoved = async () => {
  await outputStyleStore.unbindFromPod(props.pod.id, true)
  podStore.updatePodOutputStyle(props.pod.id, null)
}

const handleSkillNoteDropped = async (noteId: string) => {
  const note = skillStore.getNoteById(noteId)
  if (!note) return

  if (skillStore.isSkillBoundToPod(note.skillId, props.pod.id)) return

  await skillStore.bindToPod(noteId, props.pod.id)
}

const handleRepositoryNoteDropped = async (noteId: string) => {
  await repositoryStore.bindToPod(noteId, props.pod.id)
  const note = repositoryStore.getNoteById(noteId)
  if (note) {
    podStore.updatePodRepository(props.pod.id, note.repositoryId)
  }
}

const handleRepositoryNoteRemoved = async () => {
  await repositoryStore.unbindFromPod(props.pod.id, true)
  podStore.updatePodRepository(props.pod.id, null)
}

const handleAnchorDragStart = (data: {
  podId: string
  anchor: AnchorPosition
  screenX: number
  screenY: number
}) => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.startDragging(data.podId, data.anchor, {x: canvasX, y: canvasY})
}

const handleAnchorDragMove = (data: {screenX: number; screenY: number}) => {
  const canvasX = (data.screenX - viewportStore.offset.x) / viewportStore.zoom
  const canvasY = (data.screenY - viewportStore.offset.y) / viewportStore.zoom

  connectionStore.updateDraggingPosition({x: canvasX, y: canvasY})
}

const handleAnchorDragEnd = async () => {
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

const handleClearWorkflow = async () => {
  isLoadingDownstream.value = true

  const { wrapWebSocketRequest } = useWebSocketErrorHandler()

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

const confirmClear = async () => {
  isClearing.value = true

  const { wrapWebSocketRequest } = useWebSocketErrorHandler()

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

const cancelClear = () => {
  showClearDialog.value = false
  downstreamPods.value = []
}

const handleModelChange = async (model: ModelType) => {
  const { wrapWebSocketRequest } = useWebSocketErrorHandler()

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
      class="relative pod-with-notch pod-with-skill-notch pod-with-model-notch pod-with-repository-notch"
      :style="{ transform: `rotate(${pod.rotation}deg)` }"
    >
      <!-- Model Selector -->
      <PodModelSelector
        :pod-id="pod.id"
        :current-model="currentModel"
        @update:model="handleModelChange"
      />

      <!-- Output Style 凹槽 -->
      <div class="pod-notch-area">
        <PodOutputStyleSlot
          :pod-id="pod.id"
          :bound-note="boundNote"
          :pod-rotation="pod.rotation"
          @note-dropped="handleNoteDropped"
          @note-removed="handleNoteRemoved"
        />
      </div>

      <!-- Skill 凹槽 -->
      <div class="pod-skill-notch-area">
        <PodSkillSlot
          :pod-id="pod.id"
          :bound-notes="boundSkillNotes"
          @note-dropped="handleSkillNoteDropped"
        />
      </div>

      <!-- Repository 凹槽（右側） -->
      <div class="pod-repository-notch-area">
        <PodRepositorySlot
          :pod-id="pod.id"
          :bound-note="boundRepositoryNote"
          :pod-rotation="pod.rotation"
          @note-dropped="handleRepositoryNoteDropped"
          @note-removed="handleRepositoryNoteRemoved"
        />
      </div>

      <!-- Pod 主卡片 (增加凹槽偽元素) -->
      <div class="pod-doodle w-56 overflow-visible relative" :class="[podStatusClass, { selected: isSelected }]">
        <!-- Model 凹槽 -->
        <div class="model-notch"></div>
        <!-- Repository 凹槽（右側） -->
        <div class="repository-notch"></div>

        <!-- Anchors -->
        <PodAnchor
          position="top"
          :pod-id="pod.id"
          @drag-start="handleAnchorDragStart"
          @drag-move="handleAnchorDragMove"
          @drag-end="handleAnchorDragEnd"
        />
        <PodAnchor
          position="bottom"
          :pod-id="pod.id"
          @drag-start="handleAnchorDragStart"
          @drag-move="handleAnchorDragMove"
          @drag-end="handleAnchorDragEnd"
        />
        <PodAnchor
          position="left"
          :pod-id="pod.id"
          @drag-start="handleAnchorDragStart"
          @drag-move="handleAnchorDragMove"
          @drag-end="handleAnchorDragEnd"
        />
        <PodAnchor
          position="right"
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
          <PodMiniScreen :output="pod.output" @dblclick="handleSelectPod" />
        </div>

      </div>

      <!-- 右下角按鈕區域 -->
      <!-- Source Pod: 顯示按鈕群組 (刪除 + 橡皮擦) -->
      <div v-if="isSourcePod" class="pod-action-buttons-group">
        <!-- 刪除按鈕（左） -->
        <button
          class="pod-delete-button"
          @click.stop="handleDelete"
        >
          <Trash2 :size="16" />
        </button>
        <!-- 橡皮擦按鈕（右） -->
        <button
          class="workflow-clear-button-in-group"
          :disabled="isLoadingDownstream || isClearing"
          @click.stop="handleClearWorkflow"
        >
          <Eraser :size="16" />
        </button>
      </div>

      <!-- 非 Source Pod: 只顯示刪除按鈕 -->
      <button
        v-else
        class="pod-delete-button pod-delete-button-standalone"
        @click.stop="handleDelete"
      >
        <Trash2 :size="16" />
      </button>
    </div>

    <!-- Clear Workflow Dialog -->
    <Dialog v-model:open="showClearDialog">
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
          <Button variant="outline" @click="cancelClear" :disabled="isClearing">
            取消
          </Button>
          <Button variant="destructive" @click="confirmClear" :disabled="isClearing">
            {{ isClearing ? '清理中...' : '確認清理' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Pod Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除 Pod</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ pod.name }}」嗎？此操作無法復原。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" @click="cancelDelete">
            取消
          </Button>
          <Button variant="destructive" @click="confirmDelete">
            確認刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
