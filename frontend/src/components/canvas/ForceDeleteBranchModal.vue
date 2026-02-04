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
import { AlertTriangle } from 'lucide-vue-next'

interface Props {
  open: boolean
  branchName: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'cancel': []
  'force-delete': []
}>()

const handleCancel = (): void => {
  emit('cancel')
  emit('update:open', false)
}

const handleForceDelete = (): void => {
  emit('force-delete')
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>分支包含未合併的變更</DialogTitle>
        <DialogDescription class="space-y-3">
          <div class="flex items-start gap-2 text-destructive">
            <AlertTriangle class="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium">
                分支包含未合併的變更
              </p>
              <p class="mt-1">
                分支 <span class="font-mono">{{ branchName }}</span> 包含未合併到其他分支的變更。強制刪除將永久丟失這些變更。
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          @click="handleCancel"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          @click="handleForceDelete"
        >
          強制刪除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
