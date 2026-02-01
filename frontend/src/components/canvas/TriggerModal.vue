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
import type { TriggerTypeId } from './TriggerSubmenu.vue'

interface Props {
  open: boolean
  triggerType: TriggerTypeId
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const getTriggerTitle = (type: TriggerTypeId): string => {
  const titleMap: Record<TriggerTypeId, string> = {
    time: '時間觸發器'
  }
  return titleMap[type] || '觸發器'
}

const handleClose = (): void => {
  emit('update:open', false)
}

const handleConfirm = (): void => {
  emit('confirm')
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ getTriggerTitle(triggerType) }}</DialogTitle>
        <DialogDescription>
          觸發器設定功能開發中
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleClose"
        >
          取消
        </Button>
        <Button
          variant="default"
          @click="handleConfirm"
        >
          確認
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
