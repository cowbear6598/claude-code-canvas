<template>
  <Transition
    name="sidebar"
    @enter="onEnter"
    @leave="onLeave"
  >
    <div
      v-if="open"
      class="fixed right-0 z-40 flex h-[calc(100vh-64px)] w-72 flex-col border-l border-border bg-background"
      style="top: 64px"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 class="text-lg font-semibold">
          Canvas
        </h2>
        <button
          class="rounded-md p-1 hover:bg-accent"
          @click="handleClose"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- New Canvas Button -->
      <div class="border-b border-border p-4">
        <div v-if="isCreating" class="flex items-center gap-2">
          <input
            ref="createInputRef"
            v-model="newCanvasName"
            type="text"
            class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Canvas name"
            @keydown.enter="handleCreate"
            @keydown.escape="cancelCreate"
          >
          <button
            class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            @click="handleCreate"
          >
            Create
          </button>
        </div>
        <button
          v-else
          class="w-full rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-accent"
          @click="startCreate"
        >
          <Plus class="mr-2 inline h-4 w-4" />
          New Canvas
        </button>
      </div>

      <!-- Canvas List -->
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="canvasStore.canvases.length === 0" class="px-2 py-8 text-center text-sm text-muted-foreground">
          No canvases yet
        </div>
        <div
          v-for="canvas in canvasStore.canvases"
          :key="canvas.id"
          class="group relative mb-1"
        >
          <div
            class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
            :class="{
              'bg-accent': canvas.id === canvasStore.activeCanvasId
            }"
            @click="handleSwitchCanvas(canvas.id)"
          >
            <div v-if="renamingCanvasId === canvas.id" class="flex-1" @click.stop>
              <input
                ref="renameInputRef"
                v-model="renamingName"
                type="text"
                class="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                @keydown.enter="handleRename(canvas.id)"
                @keydown.escape="cancelRename"
                @blur="handleRename(canvas.id)"
              >
            </div>
            <span v-else class="flex-1 text-sm">{{ canvas.name }}</span>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                class="rounded-md p-1 hover:bg-accent-foreground/10"
                @click.stop="startRename(canvas.id, canvas.name)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                class="rounded-md p-1 hover:bg-destructive/20"
                @click.stop="handleDelete(canvas.id)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {ref, watch, nextTick} from 'vue'
import {X, Plus, Pencil, Trash2} from 'lucide-vue-next'
import {useCanvasStore} from '@/stores/canvasStore'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const canvasStore = useCanvasStore()

const isCreating = ref(false)
const newCanvasName = ref('')
const createInputRef = ref<HTMLInputElement | undefined>(undefined)

const renamingCanvasId = ref<string | null>(null)
const renamingName = ref('')
const renameInputRef = ref<HTMLInputElement | HTMLInputElement[] | undefined>(undefined)

const handleClose = (): void => {
  emit('update:open', false)
}

const startCreate = (): void => {
  isCreating.value = true
  newCanvasName.value = ''
  nextTick(() => {
    createInputRef.value?.focus()
  })
}

const cancelCreate = (): void => {
  isCreating.value = false
  newCanvasName.value = ''
}

const handleCreate = async (): Promise<void> => {
  if (!newCanvasName.value.trim()) return

  await canvasStore.createCanvas(newCanvasName.value.trim())
  cancelCreate()
}

const startRename = (canvasId: string, currentName: string): void => {
  renamingCanvasId.value = canvasId
  renamingName.value = currentName
  nextTick(() => {
    const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
    el?.focus()
  })
}

const cancelRename = (): void => {
  renamingCanvasId.value = null
  renamingName.value = ''
}

const handleRename = async (canvasId: string): Promise<void> => {
  if (!renamingName.value.trim()) return

  await canvasStore.renameCanvas(canvasId, renamingName.value.trim())
  cancelRename()
}

const handleDelete = async (canvasId: string): Promise<void> => {
  if (!window.confirm('確定要刪除此 Canvas?')) return

  await canvasStore.deleteCanvas(canvasId)
}

const handleSwitchCanvas = (canvasId: string): void => {
  if (renamingCanvasId.value) return

  canvasStore.switchCanvas(canvasId)
  emit('update:open', false)
}

const onEnter = (el: unknown): void => {
  const element = el as HTMLElement
  element.style.transform = 'translateX(100%)'
  element.style.transition = 'transform 0.2s ease-out'
  requestAnimationFrame(() => {
    element.style.transform = 'translateX(0)'
  })
}

const onLeave = (el: unknown): void => {
  const element = el as HTMLElement
  element.style.transition = 'transform 0.2s ease-out'
  element.style.transform = 'translateX(100%)'
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    cancelCreate()
    cancelRename()
  }
})
</script>

<style scoped>
.sidebar-enter-active,
.sidebar-leave-active {
  transition: transform 0.2s ease-out;
}

.sidebar-enter-from {
  transform: translateX(100%);
}

.sidebar-leave-to {
  transform: translateX(100%);
}
</style>
