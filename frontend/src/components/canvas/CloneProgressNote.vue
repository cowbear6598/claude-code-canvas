<script setup lang="ts">
import { computed } from 'vue'
import type { CloneTask } from '@/composables/canvas/useGitCloneProgress'

interface Props {
  tasks: Map<string, CloneTask>
}

const props = defineProps<Props>()

const tasksArray = computed(() => Array.from(props.tasks.values()))

const getProgressWidth = (task: CloneTask) => `${task.progress}%`

const getProgressBarColor = (task: CloneTask) => {
  if (task.status === 'failed') {
    return 'bg-destructive'
  }
  return 'bg-doodle-orange'
}
</script>

<template>
  <div
    v-if="tasksArray.length > 0"
    class="clone-progress-panel"
  >
    <div
      v-for="task in tasksArray"
      :key="task.requestId"
      class="clone-progress-card"
    >
      <p class="clone-progress-title">
        {{ task.repoName }}
      </p>

      <div class="clone-progress-bar-container">
        <div
          :class="getProgressBarColor(task)"
          class="clone-progress-bar"
          :style="{ width: getProgressWidth(task) }"
        />
      </div>

      <p class="clone-progress-message">
        {{ task.message }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.clone-progress-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.clone-progress-card {
  background: var(--card);
  border: 2px solid var(--doodle-ink);
  border-radius: 6px;
  padding: 12px;
  min-width: 240px;
  box-shadow: 3px 3px 0 var(--doodle-ink);
}

.clone-progress-title {
  font-family: var(--font-mono), monospace, sans-serif;
  font-size: 14px;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

.clone-progress-bar-container {
  height: 8px;
  background: var(--secondary);
  border: 1px solid var(--doodle-ink);
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 4px;
}

.clone-progress-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.clone-progress-message {
  font-size: 12px;
  color: var(--muted-foreground);
}
</style>
