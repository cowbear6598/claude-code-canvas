<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue'
import { GitBranch, Download } from 'lucide-vue-next'
import { useRepositoryStore } from '@/stores/note/repositoryStore'
import CreateWorktreeModal from './CreateWorktreeModal.vue'
import BranchSelectModal from './BranchSelectModal.vue'
import ForceCheckoutModal from './ForceCheckoutModal.vue'
import DeleteBranchModal from './DeleteBranchModal.vue'
import PullLatestConfirmModal from './PullLatestConfirmModal.vue'

interface Props {
  position: { x: number; y: number }
  repositoryId: string
  repositoryName: string
  notePosition: { x: number; y: number }
  isWorktree: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'worktree-created': []
  'branch-switched': []
}>()

const repositoryStore = useRepositoryStore()

const uiState = reactive({
  isGit: false,
  isCheckingGit: true,
  menuVisible: true,
  isLoadingBranches: false,
  isPulling: false
})

const modalState = reactive({
  showWorktree: false,
  showBranch: false,
  showForceCheckout: false,
  showDeleteBranch: false,
  showPullConfirm: false
})

const dataState = reactive({
  localBranches: [] as string[],
  currentBranch: '',
  worktreeBranches: [] as string[],
  targetBranch: '',
  branchToDelete: ''
})

onMounted(async () => {
  uiState.isCheckingGit = true
  uiState.isGit = await repositoryStore.checkIsGit(props.repositoryId)
  uiState.isCheckingGit = false
})

// 監聽所有 Modal 狀態，當選單已隱藏且所有 Modal 都關閉時，清理組件
watch(
  () => [
    modalState.showWorktree,
    modalState.showBranch,
    modalState.showForceCheckout,
    modalState.showDeleteBranch,
    modalState.showPullConfirm
  ],
  ([worktree, branch, forceCheckout, deleteBranch, pullConfirm]) => {
    const allModalsClosed = !worktree && !branch && !forceCheckout && !deleteBranch && !pullConfirm
    if (!uiState.menuVisible && allModalsClosed) {
      emit('close')
    }
  }
)

const handleCreateWorktreeClick = (): void => {
  if (!uiState.isGit) return
  uiState.menuVisible = false
  modalState.showWorktree = true
}

const handleWorktreeSubmit = async (worktreeName: string): Promise<void> => {
  const result = await repositoryStore.createWorktree(
    props.repositoryId,
    worktreeName,
    props.notePosition
  )

  if (result.success) {
    emit('worktree-created')
    emit('close')
  }
}

const handleSwitchBranchClick = async (): Promise<void> => {
  if (!uiState.isGit || props.isWorktree || uiState.isLoadingBranches) return

  uiState.menuVisible = false
  uiState.isLoadingBranches = true
  const result = await repositoryStore.getLocalBranches(props.repositoryId)
  uiState.isLoadingBranches = false

  if (!result.success || !result.branches) {
    emit('close')
    return
  }

  dataState.localBranches = result.branches
  dataState.currentBranch = result.currentBranch || ''
  dataState.worktreeBranches = result.worktreeBranches || []
  modalState.showBranch = true
}

const handleBranchSelect = async (branchName: string): Promise<void> => {
  modalState.showBranch = false

  const dirtyResult = await repositoryStore.checkDirty(props.repositoryId)

  if (!dirtyResult.success) {
    return
  }

  if (dirtyResult.isDirty) {
    dataState.targetBranch = branchName
    modalState.showForceCheckout = true
    return
  }

  await performCheckout(branchName, false)
}

const handleForceCheckout = async (): Promise<void> => {
  modalState.showForceCheckout = false
  await performCheckout(dataState.targetBranch, true)
}

const performCheckout = async (branchName: string, force: boolean): Promise<void> => {
  const result = await repositoryStore.checkoutBranch(props.repositoryId, branchName, force)

  if (result.success) {
    emit('branch-switched')
    emit('close')
  }
}

const handleBranchDelete = (branchName: string): void => {
  dataState.branchToDelete = branchName
  modalState.showBranch = false
  modalState.showDeleteBranch = true
}

const handleDeleteBranchConfirm = async (): Promise<void> => {
  const result = await repositoryStore.deleteBranch(props.repositoryId, dataState.branchToDelete)

  modalState.showDeleteBranch = false

  if (result.success) {
    await reloadBranchList()
  }
}

const reloadBranchList = async (): Promise<void> => {
  const result = await repositoryStore.getLocalBranches(props.repositoryId)
  if (result.success && result.branches) {
    dataState.localBranches = result.branches
    dataState.currentBranch = result.currentBranch || ''
    dataState.worktreeBranches = result.worktreeBranches || []
    modalState.showBranch = true
  }
}

const handlePullLatestClick = (): void => {
  if (!uiState.isGit) return
  uiState.menuVisible = false
  modalState.showPullConfirm = true
}

const handlePullLatestConfirm = async (): Promise<void> => {
  uiState.isPulling = true
  await repositoryStore.pullLatest(props.repositoryId)
  uiState.isPulling = false
  modalState.showPullConfirm = false
  emit('close')
}

const handleBackgroundClick = (): void => {
  emit('close')
}
</script>

<template>
  <!-- 背景遮罩：只在選單可見時顯示 -->
  <div
    v-if="uiState.menuVisible"
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
        :disabled="!uiState.isGit || uiState.isCheckingGit"
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs',
          uiState.isGit && !uiState.isCheckingGit ? 'hover:bg-secondary' : 'opacity-50 cursor-not-allowed'
        ]"
        @click="handleCreateWorktreeClick"
      >
        <GitBranch
          :size="14"
          class="text-foreground"
        />
        <span class="font-mono text-foreground">建立 Worktree</span>
      </button>

      <button
        v-if="!isWorktree"
        :disabled="!uiState.isGit || uiState.isCheckingGit || uiState.isLoadingBranches"
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs',
          uiState.isGit && !uiState.isCheckingGit && !uiState.isLoadingBranches ? 'hover:bg-secondary' : 'opacity-50 cursor-not-allowed'
        ]"
        @click="handleSwitchBranchClick"
      >
        <GitBranch
          :size="14"
          class="text-foreground"
        />
        <span class="font-mono text-foreground">切換分支</span>
      </button>

      <button
        v-if="!isWorktree"
        :disabled="!uiState.isGit || uiState.isCheckingGit || uiState.isPulling"
        :class="[
          'w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs',
          uiState.isGit && !uiState.isCheckingGit && !uiState.isPulling ? 'hover:bg-secondary' : 'opacity-50 cursor-not-allowed'
        ]"
        @click="handlePullLatestClick"
      >
        <Download
          :size="14"
          class="text-foreground"
        />
        <span class="font-mono text-foreground">Pull 至最新版本</span>
      </button>

      <p
        v-if="!uiState.isGit && !uiState.isCheckingGit"
        class="text-xs text-muted-foreground mt-0.5 ml-6"
      >
        此資料夾不是 Git Repository
      </p>
    </div>
  </div>

  <!-- 使用 Teleport 將 Modal 移到 body，避免父組件銷毀時 Modal 也消失 -->
  <Teleport to="body">
    <CreateWorktreeModal
      v-model:open="modalState.showWorktree"
      :repository-name="repositoryName"
      @submit="handleWorktreeSubmit"
    />

    <BranchSelectModal
      v-model:open="modalState.showBranch"
      :branches="dataState.localBranches"
      :current-branch="dataState.currentBranch"
      :repository-name="repositoryName"
      :worktree-branches="dataState.worktreeBranches"
      @select="handleBranchSelect"
      @delete="handleBranchDelete"
    />

    <ForceCheckoutModal
      v-model:open="modalState.showForceCheckout"
      :target-branch="dataState.targetBranch"
      @force-checkout="handleForceCheckout"
    />

    <DeleteBranchModal
      v-model:open="modalState.showDeleteBranch"
      :branch-name="dataState.branchToDelete"
      @confirm="handleDeleteBranchConfirm"
    />

    <PullLatestConfirmModal
      v-model:open="modalState.showPullConfirm"
      :loading="uiState.isPulling"
      @confirm="handlePullLatestConfirm"
    />
  </Teleport>
</template>
