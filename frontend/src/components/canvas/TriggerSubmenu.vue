<script setup lang="ts">
import { Clock } from 'lucide-vue-next'

export type TriggerTypeId = 'time'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'trigger-select': [type: TriggerTypeId]
}>()

interface TriggerType {
  id: TriggerTypeId
  name: string
  icon: typeof Clock
}

const triggerTypes: TriggerType[] = [
  { id: 'time', name: '時間', icon: Clock }
]

const handleTriggerSelect = (type: TriggerType): void => {
  emit('trigger-select', type.id)
}
</script>

<template>
  <div
    v-if="visible"
    class="pod-menu-submenu"
    @wheel.stop.passive
  >
    <div class="pod-menu-submenu-scrollable">
      <div
        v-for="trigger in triggerTypes"
        :key="trigger.id"
        class="pod-menu-submenu-item-wrapper"
      >
        <button
          class="pod-menu-submenu-item"
          :title="trigger.name"
          @click="handleTriggerSelect(trigger)"
        >
          <component
            :is="trigger.icon"
            :size="16"
            class="inline-block mr-2"
          />
          {{ trigger.name }}
        </button>
      </div>
    </div>
  </div>
</template>
