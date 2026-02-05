<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  title: string
  initialName?: string
  initialContent?: string
  nameEditable?: boolean
  showContent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
  initialContent: '',
  nameEditable: true,
  showContent: true
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: { name: string; content: string }]
}>()

const MAX_NAME_LENGTH = 100
const MAX_CONTENT_LENGTH = 10000

const name = ref('')
const content = ref('')

watch(
  () => props.open,
  (newOpen) => {
    if (newOpen) {
      name.value = props.initialName
      content.value = props.initialContent
    } else {
      name.value = ''
      content.value = ''
    }
  }
)

const handleSubmit = (): void => {
  // 驗證 name 長度（僅在 create 模式下檢查）
  if (props.nameEditable && (!name.value.trim() || name.value.length > MAX_NAME_LENGTH)) {
    return
  }
  // 驗證 content 長度（僅在顯示 content 時檢查）
  if (props.showContent && content.value.length > MAX_CONTENT_LENGTH) {
    return
  }
  emit('submit', { name: name.value, content: content.value })
}

const handleClose = (): void => {
  emit('update:open', false)
}

const handleKeyDown = (e: KeyboardEvent): void => {
  // 偵測 Ctrl+Enter 時提交表單
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          {{ showContent ? (mode === 'create' ? '請輸入名稱與內容' : '編輯內容') : '請輸入名稱' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <input
          v-model="name"
          placeholder="名稱"
          :disabled="!nameEditable"
          maxlength="100"
          class="w-full p-3 bg-card border-2 border-doodle-ink rounded text-base font-mono focus:outline-none focus:ring-2 focus:ring-doodle-ink/50 disabled:cursor-not-allowed disabled:opacity-50"
          @keydown.enter="!showContent && handleSubmit()"
        >

        <textarea
          v-if="showContent"
          v-model="content"
          placeholder="內容"
          maxlength="10000"
          class="w-full h-[400px] p-3 bg-card border-2 border-doodle-ink rounded text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-doodle-ink/50 doodle-textarea"
          @keydown="handleKeyDown"
        />
      </div>

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
          {{ mode === 'create' ? '建立' : '儲存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
