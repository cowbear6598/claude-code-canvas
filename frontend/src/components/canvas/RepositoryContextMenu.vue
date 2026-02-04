<script setup lang="ts">
import { reactive, onMounted, watch } from 'vue'
import { GitBranch } from 'lucide-vue-next'
import { useRepositoryStore } from '@/stores/note/repositoryStore'
import { useToast } from '@/composables/useToast'
import CreateWorktreeModal from './CreateWorktreeModal.vue'
import BranchSelectModal from './BranchSelectModal.vue'
import ForceCheckoutModal from './ForceCheckoutModal.vue'
import DeleteBranchModal from './DeleteBranchModal.vue'
import ForceDeleteBranchModal from './ForceDeleteBranchModal.vue'

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
const { toast } = useToast()

const uiState = reactive({
  isGit: false,
  isCheckingGit: true,
  menuVisible: true,
  isLoadingBranches: false
})

const modalState = reactive({
  showWorktree: false,
  showBranch: false,
  showForceCheckout: false,
  showDeleteBranch: false,
  showForceDeleteBranch: false
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
    modalState.showForceDeleteBranch
  ],
  ([worktree, branch, forceCheckout, deleteBranch, forceDelete]) => {
    const allModalsClosed = !worktree && !branch && !forceCheckout && !deleteBranch && !forceDelete
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

const handleSwitchBranchClick = async (): Promise<void> => {
  if (!uiState.isGit || props.isWorktree || uiState.isLoadingBranches) return

  uiState.menuVisible = false
  uiState.isLoadingBranches = true
  const result = await repositoryStore.getLocalBranches(props.repositoryId)
  uiState.isLoadingBranches = false

  if (!result.success || !result.branches) {
    toast({
      title: '取得分支列表失敗',
      description: result.error || '未知錯誤'
    })
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
    toast({
      title: '檢查修改狀態失敗',
      description: dirtyResult.error || '未知錯誤'
    })
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
    let description = `已切換到分支：${branchName}`

    if (result.action === 'fetched') {
      description = `已從遠端取得並切換到分支：${branchName}`
    } else if (result.action === 'created') {
      description = `已建立並切換到新分支：${branchName}`
    }

    toast({
      title: '切換分支成功',
      description
    })
    emit('branch-switched')
    emit('close')
  } else {
    toast({
      title: '切換分支失敗',
      description: result.error || '未知錯誤'
    })
  }
}

const handleBranchDelete = (branchName: string): void => {
  dataState.branchToDelete = branchName
  modalState.showBranch = false
  modalState.showDeleteBranch = true
}

const handleDeleteBranchConfirm = async (): Promise<void> => {
  const result = await repositoryStore.deleteBranch(props.repositoryId, dataState.branchToDelete, false)

  if (result.success) {
    modalState.showDeleteBranch = false
    toast({
      title: '已刪除分支',
      description: `已刪除分支：${dataState.branchToDelete}`
    })
    await reloadBranchList()
  } else {
    modalState.showDeleteBranch = false
    if (result.error?.includes('未合併') || result.error?.includes('not fully merged')) {
      modalState.showForceDeleteBranch = true
    } else {
      toast({
        title: '刪除分支失敗',
        description: result.error || '未知錯誤'
      })
    }
  }
}

const handleForceDeleteBranch = async (): Promise<void> => {
  const result = await repositoryStore.deleteBranch(props.repositoryId, dataState.branchToDelete, true)

  modalState.showForceDeleteBranch = false

  if (result.success) {
    toast({
      title: '已強制刪除分支',
      description: `已強制刪除分支：${dataState.branchToDelete}`
    })
    await reloadBranchList()
  } else {
    toast({
      title: '刪除分支失敗',
      description: result.error || '未知錯誤'
    })
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

    <ForceDeleteBranchModal
      v-model:open="modalState.showForceDeleteBranch"
      :branch-name="dataState.branchToDelete"
      @force-delete="handleForceDeleteBranch"
    />
  </Teleport>
</template>
