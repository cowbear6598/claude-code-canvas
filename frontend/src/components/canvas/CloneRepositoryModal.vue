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
import { websocketClient } from '@/services/websocket'
import { WebSocketRequestEvents } from '@/types/websocket'
import { generateRequestId } from '@/services/utils'
import { useCanvasStore } from '@/stores/canvasStore'
import type { RepositoryGitClonePayload } from '@/types/websocket'

const canvasStore = useCanvasStore()

interface Props {
  open: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'clone-started': [payload: { requestId: string; repoName: string }]
}>()

const repoUrl = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

const extractRepoName = (url: string): string => {
  const cleanUrl = url.trim().replace(/\.git$/, '')
  const urlParts = cleanUrl.split('/')
  return urlParts[urlParts.length - 1] || 'repository'
}

const validateRepoUrl = (url: string): string | null => {
  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    return '請輸入 Git Repository URL'
  }

  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('git@')) {
    return 'URL 必須以 https:// 或 git@ 開頭'
  }

  return null
}

const handleSubmit = (): void => {
  const validationError = validateRepoUrl(repoUrl.value)

  if (validationError) {
    errorMessage.value = validationError
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  const requestId = generateRequestId()
  const repoName = extractRepoName(repoUrl.value)

  const payload: RepositoryGitClonePayload = {
    requestId,
    canvasId: canvasStore.activeCanvasId!,
    repoUrl: repoUrl.value.trim(),
  }

  websocketClient.emit(WebSocketRequestEvents.REPOSITORY_GIT_CLONE, payload)

  emit('clone-started', { requestId, repoName })
  emit('update:open', false)

  repoUrl.value = ''
  isSubmitting.value = false
  errorMessage.value = ''
}

const handleClose = (): void => {
  emit('update:open', false)
  repoUrl.value = ''
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
        <DialogTitle>Clone Repository</DialogTitle>
        <DialogDescription>
          請輸入 Git Repository URL（支援 https:// 或 git@ 格式）
        </DialogDescription>
      </DialogHeader>

      <Input
        v-model="repoUrl"
        placeholder="https://github.com/user/repo.git"
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
          Clone
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
