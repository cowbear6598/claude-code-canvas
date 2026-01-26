<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Palette, Wrench } from 'lucide-vue-next'
import type { Position, PodTypeConfig, OutputStyleListItem, Skill } from '@/types'
import { podTypes } from '@/data/podTypes'
import { useOutputStyleStore, useSkillStore } from '@/stores/note'

defineProps<{
  position: Position
}>()

const emit = defineEmits<{
  select: [config: PodTypeConfig]
  'create-output-style-note': [outputStyleId: string]
  'create-skill-note': [skillId: string]
  close: []
}>()

const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const showSubmenu = ref(false)
const showSkillSubmenu = ref(false)

onMounted(async () => {
  await Promise.all([
    outputStyleStore.loadOutputStyles(),
    skillStore.loadSkills()
  ])
})

const handleSelect = (config: PodTypeConfig) => {
  emit('select', config)
}

const handleOutputStyleSelect = (style: OutputStyleListItem) => {
  showSubmenu.value = false
  emit('create-output-style-note', style.id)
  emit('close')
}

const handleSkillSelect = (skill: Skill) => {
  showSkillSubmenu.value = false
  emit('create-skill-note', skill.id)
  emit('close')
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div>
    <!-- 背景遮罩 -->
    <div class="fixed inset-0 z-40" @click="handleClose" />

    <!-- 選單內容 -->
    <div
      class="fixed z-50 bg-card border-2 border-doodle-ink rounded-lg p-2 min-w-48 origin-top-left"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
        boxShadow: '3px 3px 0 var(--doodle-ink)',
        transform: 'scale(0.8)',
      }"
    >
      <!-- Pod 按鈕 -->
      <button
        v-if="podTypes[0]"
        class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left mb-1"
        @click="handleSelect(podTypes[0])"
      >
        <span
          class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
          :style="{ backgroundColor: `var(--doodle-${podTypes[0].color})` }"
        >
          <component :is="podTypes[0].icon" :size="16" class="text-card" />
        </span>
        <span class="font-mono text-sm text-foreground">Pod</span>
      </button>

      <!-- Output Styles 按鈕 -->
      <div class="relative" @mouseenter="showSubmenu = true" @mouseleave="showSubmenu = false">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-pink)"
          >
            <Palette :size="16" class="text-card" />
          </span>
          <span class="font-mono text-sm text-foreground">Output Styles &gt;</span>
        </button>

        <!-- 子選單 -->
        <div
          v-if="showSubmenu && outputStyleStore.availableStyles.length > 0"
          class="pod-menu-submenu"
        >
          <button
            v-for="style in outputStyleStore.availableStyles"
            :key="style.id"
            class="pod-menu-submenu-item"
            @click="handleOutputStyleSelect(style)"
          >
            {{ style.name }}
          </button>
        </div>
      </div>

      <!-- Skills 按鈕 -->
      <div class="relative" @mouseenter="showSkillSubmenu = true" @mouseleave="showSkillSubmenu = false">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-green)"
          >
            <Wrench :size="16" class="text-card" />
          </span>
          <span class="font-mono text-sm text-foreground">Skills &gt;</span>
        </button>

        <!-- Skills 子選單 -->
        <div
          v-if="showSkillSubmenu && skillStore.availableSkills.length > 0"
          class="pod-menu-submenu"
        >
          <button
            v-for="skill in skillStore.availableSkills"
            :key="skill.id"
            class="pod-menu-submenu-item"
            @click="handleSkillSelect(skill)"
          >
            {{ skill.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
