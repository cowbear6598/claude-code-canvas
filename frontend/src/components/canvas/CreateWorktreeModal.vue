<script setup lang="ts">
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
import { useModalForm } from '@/composables/useModalForm'
import { validateResourceName } from '@/lib/validators'

interface Props {
  open: boolean
  repositoryName: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [worktreeName: string]
}>()

const { inputValue: worktreeName, errorMessage, handleSubmit, handleClose } = useModalForm<string>({
  validator: (name) =>
    validateResourceName(name.trim(), '請輸入 Worktree 名稱', '名稱只能包含英文字母、數字、底線和連字號'),
  onSubmit: async (name) => {
    emit('submit', name.trim())
    emit('update:open', false)
    return null
  },
  onClose: () => emit('update:open', false),
})
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
