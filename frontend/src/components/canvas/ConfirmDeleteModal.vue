<script setup lang="ts">
import { computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ItemType = 'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command' | 'mcpServer'
type GroupType = 'outputStyleGroup' | 'subAgentGroup' | 'commandGroup'
type ExtendedItemType = ItemType | GroupType

interface Props {
  open: boolean
  itemName: string
  isInUse: boolean
  itemType: ExtendedItemType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const dialogTitle = computed(() => {
  if (props.isInUse) return '無法刪除'
  return '確認刪除'
})

const dialogDescription = computed(() => {
  if (props.isInUse) return '此項目正在被 Pod 使用，無法刪除'
  return `確定要刪除「${props.itemName}」嗎？`
})

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
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>{{ dialogDescription }}</DialogDescription>
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
