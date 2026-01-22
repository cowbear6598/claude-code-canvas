<script setup lang="ts">
import { Pencil, Copy, VolumeX, Settings, Trash2 } from 'lucide-vue-next'
import type { PodColor } from '@/types'
import { COLOR_MAP } from '@/lib/constants'

defineProps<{
  color: PodColor
  isOpen: boolean
}>()

defineEmits<{
  toggle: []
  rename: []
  copy: []
  mute: []
  settings: []
  delete: []
}>()
</script>

<template>
  <div>
    <!-- 抽屜面板 - 從右側滑出 -->
    <div
      class="sticky-tab-area absolute top-3 right-0 flex items-center"
      :style="{ zIndex: -1 }"
    >
      <div
        :class="[
          COLOR_MAP[color],
          'h-8 border-2 border-doodle-ink/50 rounded-r-lg',
          'flex items-center gap-1 px-2',
          'transition-all duration-300 ease-out',
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0',
        ]"
        :style="{
          marginLeft: 'calc(100% + 14px)',
          boxShadow: '2px 2px 0 oklch(0.4 0.02 50 / 0.3)',
        }"
        @click.stop
      >
        <button
          class="p-1.5 text-doodle-ink hover:bg-card/50 rounded transition-colors"
          title="Rename"
          @click="$emit('rename')"
        >
          <Pencil :size="16" />
        </button>
        <button
          class="p-1.5 text-doodle-ink hover:bg-card/50 rounded transition-colors"
          title="Copy output"
          @click="$emit('copy')"
        >
          <Copy :size="16" />
        </button>
        <button
          class="p-1.5 text-doodle-ink hover:bg-card/50 rounded transition-colors"
          title="Mute"
          @click="$emit('mute')"
        >
          <VolumeX :size="16" />
        </button>
        <button
          class="p-1.5 text-doodle-ink hover:bg-card/50 rounded transition-colors"
          title="Settings"
          @click="$emit('settings')"
        >
          <Settings :size="16" />
        </button>
        <div class="w-px h-5 bg-doodle-ink/30 mx-0.5" />
        <button
          class="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
          title="Delete"
          @click="$emit('delete')"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <!-- 標籤手柄 -->
    <div
      :class="[
        'sticky-tab-area absolute top-3 -right-5',
        COLOR_MAP[color],
        'w-6 h-8 border-2 border-doodle-ink/50 border-l-0 rounded-r-md',
        'cursor-pointer transition-all duration-200',
        'flex items-center justify-center',
        'hover:w-8 hover:translate-x-3',
      ]"
      :style="{ boxShadow: '1px 1px 0 oklch(0.4 0.02 50 / 0.3)' }"
      @click.stop="$emit('toggle')"
    >
    </div>
  </div>
</template>

