<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTelegramStore } from '@/stores/telegramStore'
import { usePodStore } from '@/stores'
import { connectionStatusClass } from '@/utils/telegramUtils'
import type { TelegramBot } from '@/types/telegram'

interface Props {
  open: boolean
  podId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const telegramStore = useTelegramStore()
const podStore = usePodStore()

const selectedBotId = ref<string | null>(null)
const selectedMode = ref<'private' | 'group'>('group')
const selectedChatId = ref<number | null>(null)
const privateUserId = ref<string>('')

const selectedBot = computed<TelegramBot | undefined>(() =>
  selectedBotId.value ? telegramStore.getTelegramBotById(selectedBotId.value) : undefined
)

const groupChats = computed(() =>
  selectedBot.value?.chats.filter((c) => c.type === 'group' || c.type === 'supergroup') ?? []
)

const isConfirmDisabled = computed<boolean>(() => {
  if (telegramStore.telegramBots.length === 0 || !selectedBotId.value) return true
  if (selectedMode.value === 'private') {
    const parsed = parseInt(privateUserId.value, 10)
    return !privateUserId.value || isNaN(parsed) || parsed <= 0
  }
  return !selectedChatId.value
})

watch(
  () => props.open,
  (newOpen) => {
    if (!newOpen) {
      selectedBotId.value = null
      selectedMode.value = 'group'
      selectedChatId.value = null
      privateUserId.value = ''
      return
    }

    const pod = podStore.getPodById(props.podId)
    if (pod?.telegramBinding) {
      selectedBotId.value = pod.telegramBinding.telegramBotId
      selectedMode.value = pod.telegramBinding.chatType
      selectedChatId.value = pod.telegramBinding.telegramChatId
      if (pod.telegramBinding.chatType === 'private') {
        privateUserId.value = String(pod.telegramBinding.telegramChatId)
      }
    } else {
      selectedBotId.value = null
      selectedMode.value = 'group'
      selectedChatId.value = null
      privateUserId.value = ''
    }
  }
)

watch(selectedBotId, () => {
  selectedChatId.value = null
})

watch(selectedMode, () => {
  selectedChatId.value = null
  privateUserId.value = ''
})

const handleConfirm = async (): Promise<void> => {
  if (!selectedBotId.value) return

  if (selectedMode.value === 'private') {
    const userId = parseInt(privateUserId.value, 10)
    if (isNaN(userId) || userId <= 0) return
    await telegramStore.bindTelegramToPod(props.podId, selectedBotId.value, userId, 'private')
  } else {
    if (!selectedChatId.value) return
    await telegramStore.bindTelegramToPod(props.podId, selectedBotId.value, selectedChatId.value, 'group')
  }

  emit('update:open', false)
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
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>連接 Telegram</DialogTitle>
        <DialogDescription>選擇要與此 Pod 連接的 Telegram Bot 和對話模式</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div
          v-if="telegramStore.telegramBots.length === 0"
          class="py-4 text-sm text-muted-foreground"
        >
          尚未有可用的 Telegram Bot，請先前往管理介面新增
        </div>

        <template v-else>
          <div class="space-y-2">
            <Label>選擇 Bot</Label>
            <RadioGroup
              v-model="selectedBotId"
              class="space-y-2"
            >
              <div
                v-for="bot in telegramStore.telegramBots"
                :key="bot.id"
                class="flex items-center gap-3"
              >
                <RadioGroupItem
                  :id="`bot-${bot.id}`"
                  :value="bot.id"
                />
                <Label
                  :for="`bot-${bot.id}`"
                  class="flex items-center gap-2 font-normal cursor-pointer"
                >
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :class="connectionStatusClass(bot)"
                  />
                  {{ bot.name }}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div
            v-if="selectedBot"
            class="space-y-4"
          >
            <div class="space-y-2">
              <Label>選擇模式</Label>
              <RadioGroup
                v-model="selectedMode"
                class="flex gap-4"
              >
                <div class="flex items-center gap-2">
                  <RadioGroupItem
                    id="mode-private"
                    value="private"
                  />
                  <Label
                    for="mode-private"
                    class="font-normal cursor-pointer"
                  >
                    私人對話
                  </Label>
                </div>
                <div class="flex items-center gap-2">
                  <RadioGroupItem
                    id="mode-group"
                    value="group"
                  />
                  <Label
                    for="mode-group"
                    class="font-normal cursor-pointer"
                  >
                    群組
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div
              v-if="selectedMode === 'private'"
              class="space-y-2"
            >
              <Label for="private-user-id">Telegram User ID</Label>
              <Input
                id="private-user-id"
                v-model="privateUserId"
                type="text"
                placeholder="請輸入 User ID"
              />
              <p class="text-xs text-muted-foreground">
                請輸入 Telegram User ID（可透過 @userinfobot 查詢）
              </p>
            </div>

            <div
              v-else
              class="space-y-2"
            >
              <Label>選擇群組</Label>
              <div
                v-if="groupChats.length === 0"
                class="text-sm text-muted-foreground"
              >
                尚未收到任何群組訊息，請先在群組中 @Bot
              </div>
              <RadioGroup
                v-else
                v-model="selectedChatId"
                class="space-y-2"
              >
                <div
                  v-for="chat in groupChats"
                  :key="chat.id"
                  class="flex items-center gap-3"
                >
                  <RadioGroupItem
                    :id="`chat-${chat.id}`"
                    :value="chat.id"
                  />
                  <Label
                    :for="`chat-${chat.id}`"
                    class="font-normal cursor-pointer"
                  >
                    {{ chat.title ?? chat.username ?? String(chat.id) }}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </template>
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
          :disabled="isConfirmDisabled"
          @click="handleConfirm"
        >
          確認
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
