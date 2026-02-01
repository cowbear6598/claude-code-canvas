<script setup lang="ts">
import { computed } from 'vue'
import type { Connection } from '@/types/connection'
import type { Pod } from '@/types/pod'
import type { Trigger } from '@/types/trigger'
import { useConnectionStore } from '@/stores/connectionStore'
import { useConnectionPath } from '@/composables/useConnectionPath'
import { useAnchorDetection } from '@/composables/useAnchorDetection'
import { useTriggerAnchorDetection } from '@/composables/useTriggerAnchorDetection'

const props = withDefaults(
  defineProps<{
    connection: Connection
    pods: Pod[]
    triggers: Trigger[]
    isSelected: boolean
    status?: 'inactive' | 'active'
  }>(),
  {
    status: 'inactive',
  }
)

const emit = defineEmits<{
  select: [connectionId: string]
}>()

const connectionStore = useConnectionStore()
const { calculatePathData, calculateMultipleArrowPositions } = useConnectionPath()
const { getAnchorPositions } = useAnchorDetection()
const { getTriggerAnchorPosition } = useTriggerAnchorDetection()

const pathData = computed(() => {
  const targetPod = props.pods.find(p => p.id === props.connection.targetPodId)

  if (!targetPod) {
    return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
  }

  let sourceX = 0
  let sourceY = 0

  if (props.connection.sourceType === 'trigger' && props.connection.sourceTriggerId) {
    const sourceTrigger = props.triggers.find(t => t.id === props.connection.sourceTriggerId)
    if (!sourceTrigger) {
      return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
    }
    const triggerAnchor = getTriggerAnchorPosition(sourceTrigger)
    sourceX = triggerAnchor.x
    sourceY = triggerAnchor.y
  } else {
    const sourcePod = props.pods.find(p => p.id === props.connection.sourcePodId)
    if (!sourcePod) {
      return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
    }
    const sourceAnchors = getAnchorPositions(sourcePod)
    const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)
    if (!sourceAnchor) {
      return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
    }
    sourceX = sourceAnchor.x
    sourceY = sourceAnchor.y
  }

  const targetAnchors = getAnchorPositions(targetPod)
  const targetAnchor = targetAnchors.find(a => a.anchor === props.connection.targetAnchor)

  if (!targetAnchor) {
    return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
  }

  return calculatePathData(
    sourceX,
    sourceY,
    targetAnchor.x,
    targetAnchor.y,
    props.connection.sourceAnchor,
    props.connection.targetAnchor
  )
})

const lineColor = computed(() => {
  if (props.status === 'inactive') {
    return 'oklch(0.6 0.02 50 / 0.5)'
  }
  return 'oklch(0.7 0.15 50)'
})

const arrowColor = computed(() => {
  if (props.status === 'inactive') {
    return 'oklch(0.6 0.02 50 / 0.5)'
  }
  return 'oklch(0.7 0.15 50)'
})

const arrowPositions = computed(() => {
  const targetPod = props.pods.find(p => p.id === props.connection.targetPodId)

  if (!targetPod) {
    return []
  }

  let sourceX = 0
  let sourceY = 0

  if (props.connection.sourceType === 'trigger' && props.connection.sourceTriggerId) {
    const sourceTrigger = props.triggers.find(t => t.id === props.connection.sourceTriggerId)
    if (!sourceTrigger) {
      return []
    }
    const triggerAnchor = getTriggerAnchorPosition(sourceTrigger)
    sourceX = triggerAnchor.x
    sourceY = triggerAnchor.y
  } else {
    const sourcePod = props.pods.find(p => p.id === props.connection.sourcePodId)
    if (!sourcePod) {
      return []
    }
    const sourceAnchors = getAnchorPositions(sourcePod)
    const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)
    if (!sourceAnchor) {
      return []
    }
    sourceX = sourceAnchor.x
    sourceY = sourceAnchor.y
  }

  const targetAnchors = getAnchorPositions(targetPod)
  const targetAnchor = targetAnchors.find(a => a.anchor === props.connection.targetAnchor)

  if (!targetAnchor) {
    return []
  }

  return calculateMultipleArrowPositions(
    sourceX,
    sourceY,
    targetAnchor.x,
    targetAnchor.y,
    props.connection.sourceAnchor,
    props.connection.targetAnchor,
    160
  )
})

const handleClick = (e: MouseEvent): void => {
  e.stopPropagation()
  emit('select', props.connection.id)
}

const handleDoubleClick = (e: MouseEvent): void => {
  e.stopPropagation()
  connectionStore.deleteConnection(props.connection.id)
}
</script>

<template>
  <g
    :class="[
      'connection-line',
      {
        selected: isSelected,
        active: status === 'active',
        inactive: status === 'inactive',
      },
    ]"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <!-- 透明的點擊區域（寬線） -->
    <path
      class="click-area"
      :d="pathData.path"
      stroke="transparent"
      stroke-width="20"
      fill="none"
    />

    <!-- 實際可見的連線 -->
    <path
      class="line"
      :d="pathData.path"
      :stroke="lineColor"
      fill="none"
    />

    <!-- 靜態箭頭（inactive 狀態） -->
    <polygon
      v-for="(arrow, index) in arrowPositions"
      v-show="status === 'inactive'"
      :key="`static-${index}`"
      class="arrow"
      :points="`0,-5 10,0 0,5`"
      :fill="arrowColor"
      :transform="`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`"
    />

    <!-- 動畫箭頭（active 狀態） -->
    <template v-if="status === 'active'">
      <polygon
        v-for="i in 3"
        :key="`animated-${i}`"
        class="arrow arrow-animated"
        :points="`0,-5 10,0 0,5`"
        :fill="arrowColor"
      >
        <animateMotion
          dur="4s"
          :begin="`${(i - 1) * 1.33}s`"
          repeatCount="indefinite"
          :path="pathData.path"
          rotate="auto"
        />
        <animate
          attributeName="opacity"
          dur="4s"
          :begin="`${(i - 1) * 1.33}s`"
          values="0;1;1;0"
          keyTimes="0;0.1;0.9;1"
          repeatCount="indefinite"
        />
      </polygon>
    </template>
  </g>
</template>
