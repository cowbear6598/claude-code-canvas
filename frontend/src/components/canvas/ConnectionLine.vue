<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import type { Connection, ConnectionStatus, TriggerMode } from '@/types/connection'
import type { Pod } from '@/types/pod'
import { useConnectionStore } from '@/stores/connectionStore'
import { useConnectionPath } from '@/composables/useConnectionPath'
import { useAnchorDetection } from '@/composables/useAnchorDetection'
import { Loader2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    connection: Connection
    pods: Pod[]
    isSelected: boolean
    status?: ConnectionStatus
    triggerMode?: TriggerMode
    decideReason?: string
  }>(),
  {
    status: 'inactive',
    triggerMode: 'auto',
    decideReason: undefined,
  }
)

const emit = defineEmits<{
  select: [connectionId: string]
  contextmenu: [data: { connectionId: string; event: MouseEvent }]
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
  const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)

  if (!sourceAnchor) {
    return { path: '', midPoint: { x: 0, y: 0 }, angle: 0 }
  }

  const sourceX = sourceAnchor.x
  const sourceY = sourceAnchor.y

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
  // AI Decide 模式顏色優先
  if (props.triggerMode === 'ai-decide') {
    if (props.status === 'ai-deciding') {
      return 'oklch(0.65 0.14 300 / 0.8)' // 淡紫色（deciding）
    }
    if (props.status === 'ai-rejected') {
      return 'oklch(0.65 0.15 20)' // 柔和的淡紅色（rejected）
    }
    if (props.status === 'ai-error') {
      return 'oklch(0.7 0.15 60 / 0.8)'
    }
    if (props.status === 'ai-approved') {
      return 'oklch(0.7 0.15 50)' // 橘色（approved，與 auto 相同）
    }
    // inactive 時使用更淡的紫色
    return 'oklch(0.65 0.12 300 / 0.7)'
  }

  // Auto 模式原有邏輯
  if (props.status === 'inactive') {
    return 'oklch(0.6 0.02 50 / 0.5)'
  }
  return 'oklch(0.7 0.15 50)'
})

const arrowColor = computed(() => {
  // AI Decide 模式顏色優先
  if (props.triggerMode === 'ai-decide') {
    if (props.status === 'ai-deciding') {
      return 'oklch(0.65 0.14 300 / 0.8)' // 淡紫色（deciding）
    }
    if (props.status === 'ai-rejected') {
      return 'oklch(0.65 0.15 20)' // 柔和的淡紅色（rejected）
    }
    if (props.status === 'ai-error') {
      return 'oklch(0.7 0.15 60 / 0.8)'
    }
    if (props.status === 'ai-approved') {
      return 'oklch(0.7 0.15 50)' // 橘色（approved，與 auto 相同）
    }
    // inactive 時使用更淡的紫色
    return 'oklch(0.65 0.12 300 / 0.7)'
  }

  // Auto 模式原有邏輯
  if (props.status === 'inactive') {
    return 'oklch(0.6 0.02 50 / 0.5)'
  }
  return 'oklch(0.7 0.15 50)'
})

const midLabel = computed(() => {
  if (props.triggerMode !== 'ai-decide') {
    return null
  }

  if (props.status === 'ai-deciding') {
    return { type: 'deciding', text: '', class: 'deciding-label' }
  }

  // rejected 時不顯示 foreignObject 標籤（改用 X marker）
  if (props.status === 'ai-rejected') {
    return null
  }

  if (props.status === 'ai-error') {
    return { type: 'error', text: '!', class: 'error-label' }
  }

  // inactive, ai-approved
  return { type: 'ai', text: 'AI', class: 'ai-label' }
})

const tooltipText = computed(() => {
  if (!props.decideReason) return undefined

  if (props.status === 'ai-rejected') {
    return `不觸發原因：${props.decideReason}`
  }

  if (props.status === 'ai-error') {
    return `錯誤：${props.decideReason}`
  }

  return undefined
})

const arrowPositions = computed(() => {
  const sourcePod = props.pods.find(p => p.id === props.connection.sourcePodId)
  const targetPod = props.pods.find(p => p.id === props.connection.targetPodId)

  if (!sourcePod || !targetPod) {
    return []
  }

  const sourceAnchors = getAnchorPositions(sourcePod)
  const sourceAnchor = sourceAnchors.find(a => a.anchor === props.connection.sourceAnchor)

  if (!sourceAnchor) {
    return []
  }

  const sourceX = sourceAnchor.x
  const sourceY = sourceAnchor.y

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

// 是否使用 X marker（rejected 狀態）
const useXMarker = computed(() => {
  return props.triggerMode === 'ai-decide' && props.status === 'ai-rejected'
})

// Path element ref，用於計算 X marker 位置
const pathRef = ref<SVGPathElement | null>(null)

// X marker 位置（沿路徑等距分佈）
const xMarkerPositions = ref<Array<{ x: number; y: number; angle: number }>>([])

// 計算 X marker 位置
const calculateXMarkerPositions = (): void => {
  if (!pathRef.value || !useXMarker.value) {
    xMarkerPositions.value = []
    return
  }

  const path = pathRef.value
  const totalLength = path.getTotalLength()

  // 每 50px 一個 X，至少 2 個，最多 8 個
  const spacing = 50
  const count = Math.max(2, Math.min(8, Math.floor(totalLength / spacing)))

  const positions: Array<{ x: number; y: number; angle: number }> = []

  for (let i = 0; i < count; i++) {
    const distance = (totalLength / (count + 1)) * (i + 1)
    const point = path.getPointAtLength(distance)

    // 計算切線角度（用於旋轉 X）
    const delta = 2
    const point1 = path.getPointAtLength(Math.max(0, distance - delta))
    const point2 = path.getPointAtLength(Math.min(totalLength, distance + delta))
    const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x) * (180 / Math.PI)

    positions.push({ x: point.x, y: point.y, angle })
  }

  xMarkerPositions.value = positions
}

// 監聽路徑和 useXMarker 變化，重新計算位置
watch([pathData, useXMarker], () => {
  // 使用 nextTick 確保 DOM 已更新
  setTimeout(() => {
    calculateXMarkerPositions()
  }, 0)
})

onMounted(() => {
  calculateXMarkerPositions()
})

const handleClick = (e: MouseEvent): void => {
  e.stopPropagation()
  emit('select', props.connection.id)
}

const handleDoubleClick = (e: MouseEvent): void => {
  e.stopPropagation()
  connectionStore.deleteConnection(props.connection.id)
}

const handleContextMenu = (e: MouseEvent): void => {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', { connectionId: props.connection.id, event: e })
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
        'ai-decide': triggerMode === 'ai-decide',
        'ai-deciding': status === 'ai-deciding',
        'ai-approved': status === 'ai-approved',
        'ai-rejected': status === 'ai-rejected',
        'ai-error': status === 'ai-error',
      },
    ]"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @contextmenu="handleContextMenu"
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
      ref="pathRef"
      class="line"
      :d="pathData.path"
      :stroke="lineColor"
      :style="{ color: lineColor }"
      fill="none"
    />

    <!-- 靜態箭頭（inactive 狀態，包括 AI Decide 閒置時） -->
    <!-- 在 rejected 狀態時不顯示（useXMarker 此時為 true） -->
    <polygon
      v-for="(arrow, index) in arrowPositions"
      v-show="status === 'inactive' && !useXMarker"
      :key="`static-${index}`"
      class="arrow"
      :points="`0,-5 10,0 0,5`"
      :fill="arrowColor"
      :transform="`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`"
    />

    <!-- 動畫箭頭（active 或 ai-deciding 或 ai-approved 狀態） -->
    <template v-if="(status === 'active' || status === 'ai-deciding' || status === 'ai-approved') && !useXMarker">
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

    <!-- X markers（rejected 狀態） -->
    <g
      v-for="(marker, index) in xMarkerPositions"
      v-show="useXMarker"
      :key="`x-marker-${index}`"
      :transform="`translate(${marker.x}, ${marker.y}) rotate(${marker.angle})`"
    >
      <!-- X 的第一條斜線 -->
      <line
        x1="-4"
        y1="-4"
        x2="4"
        y2="4"
        :stroke="arrowColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- X 的第二條斜線 -->
      <line
        x1="4"
        y1="-4"
        x2="-4"
        y2="4"
        :stroke="arrowColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </g>

    <!-- 中間標籤 (AI Decide) -->
    <foreignObject
      v-if="midLabel"
      :x="pathData.midPoint.x - 16"
      :y="pathData.midPoint.y - 10"
      width="32"
      height="20"
      :title="tooltipText"
    >
      <div :class="['connection-mid-label', midLabel.class]">
        <Loader2
          v-if="midLabel.type === 'deciding'"
          :size="12"
        />
        <span v-else>{{ midLabel.text }}</span>
      </div>
    </foreignObject>
  </g>
</template>
