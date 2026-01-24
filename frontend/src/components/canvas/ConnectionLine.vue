<script setup lang="ts">
import { computed } from 'vue'
import type { Connection } from '@/types/connection'
import type { Pod } from '@/types/pod'
import { useConnectionStore } from '@/stores/connectionStore'
import { useConnectionPath } from '@/composables/useConnectionPath'
import { useAnchorDetection } from '@/composables/useAnchorDetection'

const props = withDefaults(
  defineProps<{
    connection: Connection
    pods: Pod[]
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

const pathData = computed(() => {
  const sourcePod = props.pods.find(p => p.id === props.connection.sourcePodId)
  const targetPod = props.pods.find(p => p.id === props.connection.targetPodId)

  if (!sourcePod || !targetPod) {
    return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
  }

  const sourceAnchors = getAnchorPositions(sourcePod)
  const targetAnchors = getAnchorPositions(targetPod)

  const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)
  const targetAnchor = targetAnchors.find(a => a.anchor === props.connection.targetAnchor)

  if (!sourceAnchor || !targetAnchor) {
    return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
  }

  return calculatePathData(
    sourceAnchor.x,
    sourceAnchor.y,
    targetAnchor.x,
    targetAnchor.y,
    props.connection.sourceAnchor,
    props.connection.targetAnchor
  )
})

const sourceColor = computed(() => {
  const pod = props.pods.find(p => p.id === props.connection.sourcePodId)
  return pod ? getPodColorValue(pod.color) : '#62a0ea'
})

const targetColor = computed(() => {
  const pod = props.pods.find(p => p.id === props.connection.targetPodId)
  return pod ? getPodColorValue(pod.color) : '#62a0ea'
})

const actualSourceColor = computed(() => {
  if (props.status === 'inactive') {
    return 'oklch(0.6 0.02 50 / 0.5)'
  }
  return 'oklch(0.7 0.15 50)'
})

const actualTargetColor = computed(() => {
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

const getPodColorValue = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: 'oklch(0.62 0.12 200)',
    coral: 'oklch(0.68 0.1 30)',
    pink: 'oklch(0.65 0.12 330)',
    yellow: 'oklch(0.88 0.1 90)',
    green: 'oklch(0.58 0.12 150)',
  }
  return colorMap[color] || 'oklch(0.62 0.12 200)'
}

const gradientId = computed(() => `gradient-${props.connection.id}`)

const arrowPositions = computed(() => {
  const sourcePod = props.pods.find(p => p.id === props.connection.sourcePodId)
  const targetPod = props.pods.find(p => p.id === props.connection.targetPodId)

  if (!sourcePod || !targetPod) {
    return []
  }

  const sourceAnchors = getAnchorPositions(sourcePod)
  const targetAnchors = getAnchorPositions(targetPod)

  const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)
  const targetAnchor = targetAnchors.find(a => a.anchor === props.connection.targetAnchor)

  if (!sourceAnchor || !targetAnchor) {
    return []
  }

  return calculateMultipleArrowPositions(
    sourceAnchor.x,
    sourceAnchor.y,
    targetAnchor.x,
    targetAnchor.y,
    props.connection.sourceAnchor,
    props.connection.targetAnchor,
    160
  )
})

const handleClick = (e: MouseEvent) => {
  e.stopPropagation()
  emit('select', props.connection.id)
}

const handleDoubleClick = (e: MouseEvent) => {
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
        inactive: status !== 'active',
        transferring: connection.workflowStatus === 'transferring',
        processing: connection.workflowStatus === 'processing',
        completed: connection.workflowStatus === 'completed',
        error: connection.workflowStatus === 'error',
      },
    ]"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" :stop-color="actualSourceColor" />
        <stop offset="100%" :stop-color="actualTargetColor" />
      </linearGradient>
    </defs>

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
      :stroke="`url(#${gradientId})`"
      fill="none"
    />

    <!-- 箭頭 -->
    <polygon
      v-for="(arrow, index) in arrowPositions"
      :key="index"
      class="arrow"
      :points="`0,-5 10,0 0,5`"
      :fill="arrowColor"
      :transform="`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`"
    />
  </g>
</template>
