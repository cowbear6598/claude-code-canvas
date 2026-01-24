<script setup lang="ts">
import { computed } from 'vue'
import { Play, Loader2, AlertCircle } from 'lucide-vue-next'
import type { Connection } from '@/types/connection'
import { useConnectionStore } from '@/stores/connectionStore'

const props = defineProps<{
  podId: string
  connections: Connection[]
}>()

const connectionStore = useConnectionStore()

const hasConnections = computed(() => props.connections.length > 0)

const workflowStatus = computed(() => {
  if (props.connections.length === 0) return 'idle'

  const statuses = props.connections.map(c => c.workflowStatus || 'idle')

  if (statuses.includes('error')) return 'error'
  if (statuses.includes('transferring')) return 'transferring'
  if (statuses.includes('processing')) return 'processing'
  if (statuses.includes('completed')) return 'completed'

  return 'idle'
})

const isDisabled = computed(() => {
  return workflowStatus.value === 'transferring' || workflowStatus.value === 'processing'
})

const buttonClass = computed(() => {
  const classes = ['workflow-trigger-btn']

  if (workflowStatus.value === 'transferring' || workflowStatus.value === 'processing') {
    classes.push('loading')
  }
  if (workflowStatus.value === 'error') {
    classes.push('error')
  }

  return classes.join(' ')
})

const handleTrigger = async () => {
  if (isDisabled.value) return

  for (const connection of props.connections) {
    try {
      await connectionStore.triggerWorkflow(connection.id)
    } catch (error) {
      console.error('[WorkflowTriggerButton] Failed to trigger workflow:', error)
    }
  }
}
</script>

<template>
  <div
    v-if="hasConnections"
    :class="buttonClass"
    :title="isDisabled ? '處理中...' : '傳遞資料'"
    @click.stop="handleTrigger"
  >
    <Play v-if="workflowStatus === 'idle' || workflowStatus === 'completed'" :size="14" />
    <Loader2 v-else-if="workflowStatus === 'transferring' || workflowStatus === 'processing'" :size="14" />
    <AlertCircle v-else-if="workflowStatus === 'error'" :size="14" />
  </div>
</template>
