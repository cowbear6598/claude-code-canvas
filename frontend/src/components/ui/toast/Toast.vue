<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
        >
          <div class="toast-content">
            <p class="toast-title">{{ toast.title }}</p>
            <p v-if="toast.description" class="toast-description">{{ toast.description }}</p>
          </div>
          <button class="toast-close" @click="dismiss(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: oklch(0.92 0.12 85);
  border: 2px solid var(--doodle-ink);
  border-radius: 8px;
  box-shadow: 4px 4px 0 oklch(0.4 0.02 50 / 0.3);
  min-width: 280px;
  max-width: 400px;
  pointer-events: auto;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--foreground);
  margin: 0;
}

.toast-description {
  font-size: 12px;
  color: var(--muted-foreground);
  margin: 4px 0 0 0;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--muted-foreground);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.toast-close:hover {
  background: oklch(0.9 0.02 50);
  color: var(--foreground);
}

/* 動畫 */
.toast-enter-active {
  animation: toast-in 0.3s ease;
}

.toast-leave-active {
  animation: toast-out 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-100%);
  }
}
</style>
