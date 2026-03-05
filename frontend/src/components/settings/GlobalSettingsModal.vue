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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getConfig, updateConfig } from '@/services/configApi'
import { MODEL_OPTIONS } from '@/types'
import type { ModelType } from '@/types/pod'
import { useToast } from '@/composables/useToast'
import { useWebSocketErrorHandler } from '@/composables/useWebSocketErrorHandler'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { showSuccessToast } = useToast()
const { withErrorToast } = useWebSocketErrorHandler()

const summaryModel = ref<ModelType>('sonnet')
const aiDecideModel = ref<ModelType>('sonnet')
const isLoading = ref<boolean>(false)
const isSaving = ref<boolean>(false)
const loadFailed = ref<boolean>(false)

const loadConfig = async (): Promise<void> => {
  isLoading.value = true
  loadFailed.value = false
  try {
    const result = await withErrorToast(getConfig(), 'Config', '載入失敗')
    if (!result) {
      loadFailed.value = true
      return
    }
    if (result.summaryModel) summaryModel.value = result.summaryModel
    if (result.aiDecideModel) aiDecideModel.value = result.aiDecideModel
  } finally {
    isLoading.value = false
  }
}

const handleSave = async (): Promise<void> => {
  isSaving.value = true
  try {
    const result = await withErrorToast(
      updateConfig({ summaryModel: summaryModel.value, aiDecideModel: aiDecideModel.value }),
      'Config',
      '儲存失敗'
    )
    if (result) {
      showSuccessToast('Config', '儲存成功')
      emit('update:open', false)
    }
  } finally {
    isSaving.value = false
  }
}

const handleClose = (): void => {
  emit('update:open', false)
}

watch(
  () => props.open,
  (newVal) => {
    if (newVal) {
      loadConfig()
    }
  },
  { immediate: true }
)
</script>

<template>
  <Dialog
    :open="open"
    @update:open="handleClose"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>全域設定</DialogTitle>
        <DialogDescription>管理模型與全域參數設定</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div class="space-y-2">
          <Label>總結模型</Label>
          <p class="text-xs text-muted-foreground">
            工作流總結時使用的模型
          </p>
          <Select v-model="summaryModel">
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem
                v-for="option in MODEL_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label>AI 決策模型</Label>
          <p class="text-xs text-muted-foreground">
            AI Decide 連線判斷時使用的模型
          </p>
          <Select v-model="aiDecideModel">
            <SelectTrigger>
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem
                v-for="option in MODEL_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          :disabled="isLoading || isSaving || loadFailed"
          @click="handleSave"
        >
          {{ isSaving ? '儲存中...' : '儲存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
