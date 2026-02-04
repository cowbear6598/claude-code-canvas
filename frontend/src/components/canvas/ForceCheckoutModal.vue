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
  targetBranch: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'cancel': []
  'force-checkout': []
}>()

const handleCancel = (): void => {
  emit('cancel')
  emit('update:open', false)
}

const handleForceCheckout = (): void => {
  emit('force-checkout')
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>有未儲存的修改</DialogTitle>
        <DialogDescription class="space-y-3">
          <div class="flex items-start gap-2 text-destructive">
            <AlertTriangle class="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium">
                目前有未 commit 的修改
              </p>
              <p class="mt-1">
                切換到 <span class="font-mono">{{ targetBranch }}</span> 將會丟失所有未 commit 的修改
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
          @click="handleForceCheckout"
        >
          強制切換
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
