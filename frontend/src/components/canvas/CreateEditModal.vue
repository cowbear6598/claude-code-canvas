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
}

const props = withDefaults(defineProps<Props>(), {
  initialName: '',
  initialContent: '',
  nameEditable: true
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: { name: string; content: string }]
}>()

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
  emit('submit', { name: name.value, content: content.value })
}

const handleClose = (): void => {
  emit('update:open', false)
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
          {{ mode === 'create' ? '請輸入名稱與內容' : '編輯內容' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <input
          v-model="name"
          placeholder="名稱"
          :disabled="!nameEditable"
          class="w-full p-3 bg-card border-2 border-doodle-ink rounded text-base font-mono focus:outline-none focus:ring-2 focus:ring-doodle-ink/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <textarea
          v-model="content"
          placeholder="內容"
          class="w-full h-[400px] p-3 bg-card border-2 border-doodle-ink rounded text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-doodle-ink/50 doodle-textarea"
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
