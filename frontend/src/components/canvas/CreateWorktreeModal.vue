<script setup lang="ts">
import { ref } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  repositoryName: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [worktreeName: string]
}>()

const worktreeName = ref('')
const errorMessage = ref('')

const validateWorktreeName = (name: string): string | null => {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return '請輸入 Worktree 名稱'
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    return '名稱只能包含英文字母、數字、底線和連字號'
  }

  return null
}

const handleSubmit = (): void => {
  const validationError = validateWorktreeName(worktreeName.value)

  if (validationError) {
    errorMessage.value = validationError
    return
  }

  emit('submit', worktreeName.value.trim())
  handleClose()
}

const handleClose = (): void => {
  emit('update:open', false)
  worktreeName.value = ''
  errorMessage.value = ''
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>建立 Worktree</DialogTitle>
        <DialogDescription>
          從 {{ repositoryName }} 建立新的 Worktree
        </DialogDescription>
      </DialogHeader>

      <div>
        <label class="text-sm font-medium">Worktree 名稱</label>
        <Input
          v-model="worktreeName"
          placeholder="例如：feature1、bugfix-123"
          @keyup.enter="handleSubmit"
        />
      </div>

      <p
        v-if="errorMessage"
        class="text-sm text-destructive"
      >
        {{ errorMessage }}
      </p>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose"
        >
          取消
        </Button>
        <Button
          variant="default"
          @click="handleSubmit"
        >
          確認
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
