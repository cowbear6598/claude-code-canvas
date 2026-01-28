<script setup lang="ts">
import {ref, onMounted, computed} from 'vue'
import {Palette, Wrench, FolderOpen, Bot} from 'lucide-vue-next'
import type {Position, PodTypeConfig, OutputStyleListItem, Skill, Repository, SubAgent} from '@/types'
import {podTypes} from '@/data/podTypes'
import {useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore} from '@/stores/note'
import CreateRepositoryModal from './CreateRepositoryModal.vue'
import ConfirmDeleteModal from './ConfirmDeleteModal.vue'
import PodTypeMenuSubmenu from './PodTypeMenuSubmenu.vue'

defineProps<{
  position: Position
}>()

const emit = defineEmits<{
  select: [config: PodTypeConfig]
  'create-output-style-note': [outputStyleId: string]
  'create-skill-note': [skillId: string]
  'create-subagent-note': [subAgentId: string]
  'create-repository-note': [repositoryId: string]
  close: []
}>()

const outputStyleStore = useOutputStyleStore()
const skillStore = useSkillStore()
const subAgentStore = useSubAgentStore()
const repositoryStore = useRepositoryStore()
const showSubmenu = ref(false)
const showSkillSubmenu = ref(false)
const showSubAgentSubmenu = ref(false)
const showRepositorySubmenu = ref(false)
const showCreateRepositoryModal = ref(false)
const showDeleteModal = ref(false)
type ItemType = 'outputStyle' | 'skill' | 'repository' | 'subAgent'

interface DeleteTarget {
  type: ItemType
  id: string
  name: string
}

const deleteTarget = ref<DeleteTarget | null>(null)
const hoveredItemId = ref<string | null>(null)

const isDeleteTargetInUse = computed(() => {
  if (!deleteTarget.value) return false

  const { type, id } = deleteTarget.value

  const inUseChecks = {
    outputStyle: () => outputStyleStore.isItemInUse(id),
    skill: () => skillStore.isItemInUse(id),
    subAgent: () => subAgentStore.isItemInUse(id),
    repository: () => repositoryStore.isItemInUse(id),
  }

  return inUseChecks[type]()
})

onMounted(async () => {
  await Promise.all([
    outputStyleStore.loadOutputStyles(),
    skillStore.loadSkills(),
    subAgentStore.loadSubAgents(),
    repositoryStore.loadRepositories()
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

const handleSubAgentSelect = (subAgent: SubAgent) => {
  showSubAgentSubmenu.value = false
  emit('create-subagent-note', subAgent.id)
  emit('close')
}

const handleRepositorySelect = (repository: Repository) => {
  showRepositorySubmenu.value = false
  emit('create-repository-note', repository.id)
  emit('close')
}

const handleClose = () => {
  emit('close')
}

const handleRepositoryCreated = (repository: { id: string; name: string }) => {
  showRepositorySubmenu.value = false
  emit('create-repository-note', repository.id)
  emit('close')
}

const handleDeleteClick = (type: ItemType, id: string, name: string, event: Event) => {
  event.stopPropagation()
  deleteTarget.value = { type, id, name }
  showDeleteModal.value = true
}

const handleDeleteConfirm = async () => {
  if (!deleteTarget.value) return

  const { type, id } = deleteTarget.value

  const deleteActions = {
    outputStyle: () => outputStyleStore.deleteOutputStyle(id),
    skill: () => skillStore.deleteSkill(id),
    subAgent: () => subAgentStore.deleteSubAgent(id),
    repository: () => repositoryStore.deleteRepository(id),
  }

  await deleteActions[type]()

  showDeleteModal.value = false
  deleteTarget.value = null
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

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="outputStyleStore.availableItems"
          :visible="showSubmenu"
          @item-select="handleOutputStyleSelect"
          @item-delete="(id, name, event) => handleDeleteClick('outputStyle', id, name, event)"
        />
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

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="skillStore.availableItems"
          :visible="showSkillSubmenu"
          @item-select="handleSkillSelect"
          @item-delete="(id, name, event) => handleDeleteClick('skill', id, name, event)"
        />
      </div>

      <!-- SubAgents 按鈕 -->
      <div class="relative" @mouseenter="showSubAgentSubmenu = true" @mouseleave="showSubAgentSubmenu = false">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-sand)"
          >
            <Bot :size="16" class="text-card" />
          </span>
          <span class="font-mono text-sm text-foreground">SubAgents &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="subAgentStore.availableItems"
          :visible="showSubAgentSubmenu"
          @item-select="handleSubAgentSelect"
          @item-delete="(id, name, event) => handleDeleteClick('subAgent', id, name, event)"
        />
      </div>

      <!-- Repository 按鈕 -->
      <div class="relative" @mouseenter="showRepositorySubmenu = true" @mouseleave="showRepositorySubmenu = false">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-orange)"
          >
            <FolderOpen :size="16" class="text-card" />
          </span>
          <span class="font-mono text-sm text-foreground">Repository &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="repositoryStore.availableItems"
          :visible="showRepositorySubmenu"
          @item-select="handleRepositorySelect"
          @item-delete="(id, name, event) => handleDeleteClick('repository', id, name, event)"
        >
          <template #footer>
            <div class="border-t border-doodle-ink/30 my-1" />
            <div class="pod-menu-submenu-item" @click="showCreateRepositoryModal = true">
              + 新建資料夾
            </div>
          </template>
        </PodTypeMenuSubmenu>
      </div>
    </div>

    <CreateRepositoryModal
      v-model:open="showCreateRepositoryModal"
      @created="handleRepositoryCreated"
    />

    <ConfirmDeleteModal
      v-model:open="showDeleteModal"
      :item-name="deleteTarget?.name ?? ''"
      :is-in-use="isDeleteTargetInUse"
      :item-type="deleteTarget?.type ?? 'outputStyle'"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>
