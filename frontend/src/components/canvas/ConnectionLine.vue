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
