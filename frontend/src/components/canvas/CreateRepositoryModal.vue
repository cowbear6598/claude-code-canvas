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
import { useRepositoryStore } from '@/stores/note'
import { useModalForm } from '@/composables/useModalForm'
import { validateResourceName } from '@/lib/validators'

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [repository: { id: string; name: string }]
}>()

const repositoryStore = useRepositoryStore()

const { inputValue: folderName, isSubmitting, errorMessage, handleSubmit, handleClose } = useModalForm<string>({
  validator: (name) =>
    validateResourceName(name, '請輸入資料夾名稱', '只允許英數字、底線、連字號'),
  onSubmit: async (name) => {
    const result = await repositoryStore.createRepository(name)
    if (result.success && result.repository) {
      emit('created', result.repository)
      emit('update:open', false)
      return null
    }
    return result.error || '建立資料夾失敗'
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
        <DialogTitle>新建資料夾</DialogTitle>
        <DialogDescription>
          請輸入資料夾名稱（只允許英數字、底線、連字號）
        </DialogDescription>
      </DialogHeader>

      <Input
        v-model="folderName"
        placeholder="folder_name"
        @keyup.enter="handleSubmit"
      />

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
          :disabled="isSubmitting"
          @click="handleSubmit"
        >
          建立
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
