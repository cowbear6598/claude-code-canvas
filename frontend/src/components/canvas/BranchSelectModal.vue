<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

interface Props {
  open: boolean
  branches: string[]
  currentBranch: string
  repositoryName: string
  worktreeBranches?: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [branchName: string]
  'delete': [branchName: string]
}>()

const { toast } = useToast()
const inputBranchName = ref('')

// 分支名稱驗證模式（與後端一致）
const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9_\-/]+$/

const isValidBranchName = (name: string): boolean => {
  if (!BRANCH_NAME_PATTERN.test(name)) {
    return false
  }
  // 禁止連續斜線
  if (name.includes('//')) {
    return false
  }
  // 禁止以斜線開頭或結尾
  if (name.startsWith('/') || name.endsWith('/')) {
    return false
  }
  return true
}

const normalBranches = computed(() => {
  if (!props.worktreeBranches || props.worktreeBranches.length === 0) {
    return props.branches
  }
  return props.branches.filter(branch => !props.worktreeBranches!.includes(branch))
})

const hasWorktreeBranches = computed(() => {
  return props.worktreeBranches && props.worktreeBranches.length > 0
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    inputBranchName.value = ''
  }
})

const handleBranchClick = (branchName: string): void => {
  if (branchName === props.currentBranch) {
    return
  }
  emit('select', branchName)
}

const handleInputSubmit = (): void => {
  const trimmedName = inputBranchName.value.trim()

  if (!trimmedName) {
    return
  }

  // 格式驗證
  if (!isValidBranchName(trimmedName)) {
    toast({
      title: '分支名稱格式錯誤',
      description: '只能包含英文字母、數字、底線、連字號和斜線',
      variant: 'destructive'
    })
    return
  }

  emit('select', trimmedName)
}

const handleInputKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleInputSubmit()
  }
}

const handleClose = (): void => {
  emit('update:open', false)
}

const handleDeleteClick = (event: Event, branchName: string): void => {
  event.stopPropagation()
  emit('delete', branchName)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>切換分支</DialogTitle>
        <DialogDescription>
          選擇要切換的分支 ({{ repositoryName }})
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2">
        <Input
          v-model="inputBranchName"
          placeholder="輸入分支名稱"
          @keydown="handleInputKeydown"
        />
        <Button
          :disabled="!inputBranchName.trim()"
          @click="handleInputSubmit"
        >
          切換
        </Button>
      </div>

      <div class="border-t my-4" />

      <ScrollArea class="max-h-60 pr-4">
        <div class="space-y-1">
          <div
            v-for="branch in normalBranches"
            :key="branch"
            :class="[
              'w-full flex items-center gap-2 px-3 py-2 font-mono text-sm rounded-md transition-colors group',
              branch === currentBranch
                ? 'bg-secondary text-muted-foreground'
                : 'hover:bg-secondary cursor-pointer'
            ]"
          >
            <button
              type="button"
              class="flex-1 text-left"
              :class="[
                branch === currentBranch ? 'cursor-default' : 'cursor-pointer'
              ]"
              @click="handleBranchClick(branch)"
            >
              {{ branch }}
              <span
                v-if="branch === currentBranch"
                class="ml-2 text-muted-foreground"
              >(目前)</span>
            </button>
            <button
              v-if="branch !== currentBranch"
              type="button"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
              @click="handleDeleteClick($event, branch)"
            >
              <Trash2
                :size="14"
                class="text-destructive"
              />
            </button>
          </div>

          <template v-if="hasWorktreeBranches">
            <div class="flex items-center gap-2 py-2">
              <div class="flex-1 border-t border-border"></div>
              <span class="text-xs text-muted-foreground">已被 Worktree 佔用</span>
              <div class="flex-1 border-t border-border"></div>
            </div>

            <div
              v-for="branch in worktreeBranches"
              :key="`worktree-${branch}`"
              class="w-full flex items-center gap-2 px-3 py-2 font-mono text-sm rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
            >
              <span class="flex-1">{{ branch }}</span>
            </div>
          </template>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose"
        >
          取消
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
