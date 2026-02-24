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
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
}>()
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Pull 至最新版本</DialogTitle>
        <DialogDescription class="space-y-3">
          <div class="flex items-start gap-2 text-destructive">
            <AlertTriangle class="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium">
                此操作將丟棄所有本地修改
              </p>
              <p class="mt-1">
                執行 git fetch + git reset --hard 將無法還原未 commit 的變更
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="gap-2">
        <Button
          variant="outline"
          :disabled="loading"
          @click="emit('update:open', false)"
        >
          取消
        </Button>
        <Button
          variant="destructive"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ loading ? 'Pull 中...' : '確認 Pull' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
