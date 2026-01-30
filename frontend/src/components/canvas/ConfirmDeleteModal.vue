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

type ItemType = 'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command'

interface Props {
  open: boolean
  itemName: string
  isInUse: boolean
  itemType: ItemType
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

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
        <DialogTitle>{{ isInUse ? '無法刪除' : '確認刪除' }}</DialogTitle>
        <DialogDescription>
          {{ isInUse
            ? '此項目正在被 Pod 使用，無法刪除'
            : `確定要刪除「${itemName}」嗎？`
          }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <template v-if="isInUse">
          <Button
            variant="outline"
            @click="handleClose"
          >
            確定
          </Button>
        </template>
        <template v-else>
          <Button
            variant="outline"
            @click="handleClose"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            @click="handleConfirm"
          >
            刪除
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
