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
import { useRepositoryStore } from '@/stores/note'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: [repository: { id: string; name: string }]
}>()

const repositoryStore = useRepositoryStore()

const folderName = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

const validateFolderName = (name: string): string | null => {
  if (!name.trim()) {
    return '請輸入資料夾名稱'
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return '只允許英數字、底線、連字號'
  }
  return null
}

const handleSubmit = async (): Promise<void> => {
  const validationError = validateFolderName(folderName.value)
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  const result = await repositoryStore.createRepository(folderName.value)

  isSubmitting.value = false

  if (result.success && result.repository) {
    emit('created', result.repository)
    emit('update:open', false)
    folderName.value = ''
    errorMessage.value = ''
  } else {
    errorMessage.value = result.error || '建立資料夾失敗'
  }
}

const handleClose = (): void => {
  emit('update:open', false)
  folderName.value = ''
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
