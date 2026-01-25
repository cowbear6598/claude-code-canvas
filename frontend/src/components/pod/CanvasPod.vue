<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { Pod, ModelType } from '@/types'
import type { AnchorPosition } from '@/types/connection'
import { useCanvasStore } from '@/stores/canvasStore'
import { useOutputStyleStore } from '@/stores/outputStyleStore'
import { useSkillStore } from '@/stores/skillStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useChatStore } from '@/stores/chatStore'
import { useAnchorDetection } from '@/composables/useAnchorDetection'
import { websocketService } from '@/services/websocket'
import { generateRequestId } from '@/services/utils'
import type {
  WorkflowGetDownstreamPodsResultPayload,
  WorkflowClearResultPayload,
  PodUpdatedPayload
} from '@/types/websocket'
import PodHeader from './PodHeader.vue'
import PodMiniScreen from './PodMiniScreen.vue'
import PodStickyTab from './PodStickyTab.vue'
import PodOutputStyleSlot from './PodOutputStyleSlot.vue'
import PodSkillSlot from './PodSkillSlot.vue'
import PodAnchor from './PodAnchor.vue'
import PodModelSelector from './PodModelSelector.vue'
import { Eraser } from 'lucide-vue-next'
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
  pod: Pod
}>()

const canvasStore = useCanvasStore()
const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const connectionStore = useConnectionStore()
const chatStore = useChatStore()
const { detectTargetAnchor } = useAnchorDetection()

const isActive = computed(() => props.pod.id === canvasStore.activePodId)
const boundNote = computed(() => outputStyleStore.getNoteByPodId(props.pod.id))
const boundSkillNotes = computed(() => skillStore.getNotesByPodId(props.pod.id))
const isSourcePod = computed(() => connectionStore.isSourcePod(props.pod.id))
const currentModel = computed(() => props.pod.model ?? 'opus')

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

const showClearDialog = ref(false)
const downstreamPods = ref<Array<{ id: string; name: string }>>([])
const isLoadingDownstream = ref(false)
const isClearing = ref(false)

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
    (e.target as HTMLElement).closest('.pod-output-style-slot') ||
    (e.target as HTMLElement).closest('.pod-skill-slot')
  ) {
    return
  }

  canvasStore.setActivePod(props.pod.id)

  // 取消 connection 選取
  connectionStore.selectConnection(null)

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
  await outputStyleStore.bindToPod(noteId, props.pod.id)
  const note = outputStyleStore.getNoteById(noteId)
  if (note) {
    canvasStore.updatePodOutputStyle(props.pod.id, note.outputStyleId)
  }
}

const handleNoteRemoved = async () => {
  await outputStyleStore.unbindFromPod(props.pod.id, true)
  canvasStore.updatePodOutputStyle(props.pod.id, null)
}

const handleSkillNoteDropped = async (noteId: string) => {
  const note = skillStore.getNoteById(noteId)
  if (!note) {
    console.warn('[CanvasPod] Note not found:', noteId)
    return
  }

  // Check if this skill is already bound to this pod
  if (skillStore.isSkillBoundToPod(note.skillId, props.pod.id)) {
    console.warn('[CanvasPod] Skill already bound to this pod:', note.skillId)
    // Note will fly back to original position automatically via animation
    return
  }

  await skillStore.bindToPod(noteId, props.pod.id)
}

const handleAnchorDragStart = (data: {
  podId: string
  anchor: AnchorPosition
  screenX: number
  screenY: number
}) => {
  const canvasX = (data.screenX - canvasStore.viewport.offset.x) / canvasStore.viewport.zoom
  const canvasY = (data.screenY - canvasStore.viewport.offset.y) / canvasStore.viewport.zoom

  connectionStore.startDragging(data.podId, data.anchor, { x: canvasX, y: canvasY })
}

const handleAnchorDragMove = (data: { screenX: number; screenY: number }) => {
  const canvasX = (data.screenX - canvasStore.viewport.offset.x) / canvasStore.viewport.zoom
  const canvasY = (data.screenY - canvasStore.viewport.offset.y) / canvasStore.viewport.zoom

  connectionStore.updateDraggingPosition({ x: canvasX, y: canvasY })
}

const handleAnchorDragEnd = async () => {
  if (!connectionStore.draggingConnection) {
    connectionStore.endDragging()
    return
  }

  const { sourcePodId, sourceAnchor, currentPoint } = connectionStore.draggingConnection

  const targetAnchor = detectTargetAnchor(currentPoint, canvasStore.pods, sourcePodId)

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

const handleClearWorkflow = () => {
  isLoadingDownstream.value = true
  const requestId = generateRequestId()

  const handleResult = (payload: WorkflowGetDownstreamPodsResultPayload) => {
    if (payload.requestId === requestId) {
      websocketService.offWorkflowGetDownstreamPodsResult(handleResult)
      isLoadingDownstream.value = false

      if (payload.success && payload.pods) {
        downstreamPods.value = payload.pods
        showClearDialog.value = true
      } else {
        console.error('[CanvasPod] Failed to get downstream pods:', payload.error)
      }
    }
  }

  websocketService.onWorkflowGetDownstreamPodsResult(handleResult)
  websocketService.workflowGetDownstreamPods({
    requestId,
    sourcePodId: props.pod.id
  })

  setTimeout(() => {
    websocketService.offWorkflowGetDownstreamPodsResult(handleResult)
    if (isLoadingDownstream.value) {
      isLoadingDownstream.value = false
      console.error('[CanvasPod] Get downstream pods timeout')
    }
  }, 10000)
}

const confirmClear = () => {
  isClearing.value = true
  const requestId = generateRequestId()

  const handleResult = (payload: WorkflowClearResultPayload) => {
    if (payload.requestId === requestId) {
      websocketService.offWorkflowClearResult(handleResult)
      isClearing.value = false

      if (payload.success && payload.clearedPodIds) {
        chatStore.clearMessagesByPodIds(payload.clearedPodIds)
        canvasStore.clearPodOutputsByIds(payload.clearedPodIds)
        showClearDialog.value = false
        downstreamPods.value = []
      } else {
        console.error('[CanvasPod] Failed to clear workflow:', payload.error)
      }
    }
  }

  websocketService.onWorkflowClearResult(handleResult)
  websocketService.workflowClear({
    requestId,
    sourcePodId: props.pod.id
  })

  setTimeout(() => {
    websocketService.offWorkflowClearResult(handleResult)
    if (isClearing.value) {
      isClearing.value = false
      console.error('[CanvasPod] Workflow clear timeout')
    }
  }, 10000)
}

const cancelClear = () => {
  showClearDialog.value = false
  downstreamPods.value = []
}

const handleModelChange = (model: ModelType) => {
  console.log('[CanvasPod] handleModelChange called with model:', model, 'for pod:', props.pod.id)
  const requestId = generateRequestId()

  const handleResult = (payload: PodUpdatedPayload) => {
    if (payload.requestId === requestId) {
      websocketService.offPodUpdated(handleResult)

      if (payload.success && payload.pod) {
        console.log('[CanvasPod] Model updated successfully:', payload.pod)
        canvasStore.updatePodModel(props.pod.id, payload.pod.model ?? 'opus')
      } else {
        console.error('[CanvasPod] Failed to update model:', payload.error)
      }
    }
  }

  websocketService.onPodUpdated(handleResult)
  console.log('[CanvasPod] Sending pod update request:', { requestId, podId: props.pod.id, model })
  websocketService.podUpdate({
    requestId,
    podId: props.pod.id,
    model
  })

  setTimeout(() => {
    websocketService.offPodUpdated(handleResult)
  }, 10000)
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
      class="relative pod-with-notch pod-with-skill-notch pod-with-model-notch"
      :style="{ transform: `rotate(${pod.rotation}deg)` }"
    >
      <!-- Model Selector -->
      <PodModelSelector
        :pod-id="pod.id"
        :current-model="currentModel"
        @update:model="handleModelChange"
      />

      <!-- 粘性標籤 -->
      <PodStickyTab
        :color="pod.color"
        :is-open="isTabOpen"
        @toggle="handleToggleTab"
        @rename="handleRename"
        @copy="handleCopy"
        @delete="handleDelete"
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

      <!-- Pod 主卡片 (增加凹槽偽元素) -->
      <div class="pod-doodle w-56 overflow-visible relative">
        <!-- Model 凹槽 -->
        <div class="model-notch"></div>

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
          />

          <!-- 迷你螢幕 -->
          <PodMiniScreen :output="pod.output" @dblclick="handleSelectPod" />
        </div>

      </div>

      <!-- Workflow Clear Button (只顯示在 Source POD，放在 POD 右下角外側) -->
      <button
        v-if="isSourcePod"
        class="workflow-clear-button"
        :disabled="isLoadingDownstream || isClearing"
        @click.stop="handleClearWorkflow"
      >
        <Eraser :size="16" />
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
  </div>
</template>
