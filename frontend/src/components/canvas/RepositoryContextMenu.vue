<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GitBranch } from 'lucide-vue-next'
import { useRepositoryStore } from '@/stores/note/repositoryStore'
import { useToast } from '@/composables/useToast'
import CreateWorktreeModal from './CreateWorktreeModal.vue'

interface Props {
  position: { x: number; y: number }
  repositoryId: string
  repositoryName: string
  notePosition: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'worktree-created': []
}>()

const repositoryStore = useRepositoryStore()
const { toast } = useToast()

const isGit = ref(false)
const isCheckingGit = ref(true)
const showWorktreeModal = ref(false)

onMounted(async () => {
  isCheckingGit.value = true
  isGit.value = await repositoryStore.checkIsGit(props.repositoryId)
  isCheckingGit.value = false
})

const handleCreateWorktreeClick = (): void => {
  if (!isGit.value) return
  showWorktreeModal.value = true
}

const handleWorktreeSubmit = async (worktreeName: string): Promise<void> => {
  const result = await repositoryStore.createWorktree(
    props.repositoryId,
    worktreeName,
    props.notePosition
  )

  if (result.success) {
    toast({
      title: 'Worktree 建立成功',
      description: `已建立 Worktree：${worktreeName}`
    })
    emit('worktree-created')
    emit('close')
  } else {
    toast({
      title: 'Worktree 建立失敗',
      description: result.error || '未知錯誤'
    })
  }
}

const handleBackgroundClick = (): void => {
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-40"
    @click="handleBackgroundClick"
  >
    <div
      class="bg-card border border-doodle-ink rounded-md p-1 fixed z-50"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }"
      @click.stop
    >
      <button
        :disabled="!isGit || isCheckingGit"
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs',
          isGit && !isCheckingGit ? 'hover:bg-secondary' : 'opacity-50 cursor-not-allowed'
        ]"
        @click="handleCreateWorktreeClick"
      >
        <GitBranch
          :size="14"
          class="text-foreground"
        />
        <span class="font-mono text-foreground">建立 Worktree</span>
      </button>
      <p
        v-if="!isGit && !isCheckingGit"
        class="text-xs text-muted-foreground mt-0.5 ml-6"
      >
        此資料夾不是 Git Repository
      </p>
    </div>
  </div>

  <CreateWorktreeModal
    v-model:open="showWorktreeModal"
    :repository-name="repositoryName"
    @submit="handleWorktreeSubmit"
  />
</template>
