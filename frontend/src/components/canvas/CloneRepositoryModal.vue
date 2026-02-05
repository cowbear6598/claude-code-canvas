<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import type { GitPlatform } from '@/types/repository'
import { parseGitUrl, getPlatformDisplayName } from '@/utils/gitUrlParser'

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
const detectedPlatform = ref<GitPlatform | null>(null)

const platformDisplayName = computed(() => {
  if (!detectedPlatform.value) {
    return ''
  }
  return getPlatformDisplayName(detectedPlatform.value)
})

watch(repoUrl, (newUrl) => {
  if (!newUrl.trim()) {
    detectedPlatform.value = null
    return
  }

  const parseResult = parseGitUrl(newUrl)
  detectedPlatform.value = parseResult.isValid ? parseResult.platform : null
})

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
          請輸入 Git Repository URL
        </DialogDescription>
      </DialogHeader>

      <Input
        v-model="repoUrl"
        placeholder=""
        @keyup.enter="handleSubmit"
      />

      <p
        v-if="detectedPlatform"
        class="text-sm text-muted-foreground"
      >
        偵測到 {{ platformDisplayName }}
      </p>

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
