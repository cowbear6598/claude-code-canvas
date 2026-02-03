<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Palette, Wrench, FolderOpen, Bot, Github, FolderPlus, FilePlus } from 'lucide-vue-next'
import type { Position, PodTypeConfig, OutputStyleListItem, Skill, Repository, SubAgent } from '@/types'
import { podTypes } from '@/data/podTypes'
import { useCanvasContext } from '@/composables/canvas/useCanvasContext'
import { useMenuPosition } from '@/composables/useMenuPosition'
import CreateRepositoryModal from './CreateRepositoryModal.vue'
import CloneRepositoryModal from './CloneRepositoryModal.vue'
import ConfirmDeleteModal from './ConfirmDeleteModal.vue'
import PodTypeMenuSubmenu from './PodTypeMenuSubmenu.vue'
import CreateEditModal from './CreateEditModal.vue'

interface Props {
  position: Position
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [config: PodTypeConfig]
  'create-output-style-note': [outputStyleId: string]
  'create-skill-note': [skillId: string]
  'create-subagent-note': [subAgentId: string]
  'create-repository-note': [repositoryId: string]
  'create-command-note': [commandId: string]
  'clone-started': [payload: { requestId: string; repoName: string }]
  close: []
}>()

const {
  outputStyleStore,
  skillStore,
  subAgentStore,
  repositoryStore,
  commandStore
} = useCanvasContext()

type ItemType = 'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command'
type ResourceType = 'outputStyle' | 'subAgent' | 'command'

interface DeleteTarget {
  type: ItemType
  id: string
  name: string
}

interface EditModalState {
  visible: boolean
  mode: 'create' | 'edit'
  title: string
  initialName: string
  initialContent: string
  resourceType: ResourceType
  itemId: string
}

const openMenuType = ref<'outputStyle' | 'skill' | 'subAgent' | 'repository' | 'command' | null>(null)
const showCreateRepositoryModal = ref(false)
const showCloneRepositoryModal = ref(false)
const showDeleteModal = ref(false)
const deleteTarget = ref<DeleteTarget | null>(null)
const hoveredItemId = ref<string | null>(null)

const editModal = ref<EditModalState>({
  visible: false,
  mode: 'create',
  title: '',
  initialName: '',
  initialContent: '',
  resourceType: 'outputStyle',
  itemId: ''
})

const isDeleteTargetInUse = computed(() => {
  if (!deleteTarget.value) return false

  const { type, id } = deleteTarget.value

  const inUseChecks = {
    outputStyle: (): boolean => outputStyleStore.isItemInUse(id),
    skill: (): boolean => skillStore.isItemInUse(id),
    subAgent: (): boolean => subAgentStore.isItemInUse(id),
    repository: (): boolean => repositoryStore.isItemInUse(id),
    command: (): boolean => commandStore.isItemInUse(id),
  }

  return inUseChecks[type]()
})

onMounted(async () => {
  await Promise.all([
    outputStyleStore.loadOutputStyles(),
    skillStore.loadSkills(),
    subAgentStore.loadSubAgents(),
    repositoryStore.loadRepositories(),
    commandStore.loadCommands()
  ])
})

const handleSelect = (config: PodTypeConfig): void => {
  emit('select', config)
}

const handleOutputStyleSelect = (style: OutputStyleListItem): void => {
  openMenuType.value = null
  emit('create-output-style-note', style.id)
  emit('close')
}

const handleSkillSelect = (skill: Skill): void => {
  openMenuType.value = null
  emit('create-skill-note', skill.id)
  emit('close')
}

const handleSubAgentSelect = (subAgent: SubAgent): void => {
  openMenuType.value = null
  emit('create-subagent-note', subAgent.id)
  emit('close')
}

const handleRepositorySelect = (repository: Repository): void => {
  openMenuType.value = null
  emit('create-repository-note', repository.id)
  emit('close')
}

const handleCommandSelect = (command: { id: string; name: string }): void => {
  openMenuType.value = null
  emit('create-command-note', command.id)
  emit('close')
}

const handleClose = (): void => {
  emit('close')
}

const handleRepositoryCreated = (repository: { id: string; name: string }): void => {
  openMenuType.value = null
  emit('create-repository-note', repository.id)
  emit('close')
}

const handleCloneStarted = (payload: { requestId: string; repoName: string }): void => {
  openMenuType.value = null
  emit('clone-started', payload)
  emit('close')
}

const handleDeleteClick = (type: ItemType, id: string, name: string, event: Event): void => {
  event.stopPropagation()
  deleteTarget.value = { type, id, name }
  showDeleteModal.value = true
}

const handleDeleteConfirm = async (): Promise<void> => {
  if (!deleteTarget.value) return

  const { type, id } = deleteTarget.value

  const deleteActions = {
    outputStyle: (): Promise<void> => outputStyleStore.deleteOutputStyle(id),
    skill: (): Promise<void> => skillStore.deleteSkill(id),
    subAgent: (): Promise<void> => subAgentStore.deleteSubAgent(id),
    repository: (): Promise<void> => repositoryStore.deleteRepository(id),
    command: (): Promise<void> => commandStore.deleteCommand(id),
  }

  await deleteActions[type]()

  showDeleteModal.value = false
  deleteTarget.value = null
}

const openCreateModal = (resourceType: ResourceType, title: string): void => {
  editModal.value = {
    visible: true,
    mode: 'create',
    title,
    initialName: '',
    initialContent: '',
    resourceType,
    itemId: ''
  }
}

const handleNewOutputStyle = (): void => openCreateModal('outputStyle', '新增 Output Style')
const handleNewSubAgent = (): void => openCreateModal('subAgent', '新增 SubAgent')
const handleNewCommand = (): void => openCreateModal('command', '新增 Command')

const resourceTitleMap = {
  outputStyle: 'Output Style',
  subAgent: 'SubAgent',
  command: 'Command'
} as const

const readActions: Record<ResourceType, (id: string) => Promise<{ id: string; name: string; content: string } | null>> = {
  outputStyle: (id) => outputStyleStore.readOutputStyle(id),
  subAgent: (id) => subAgentStore.readSubAgent(id),
  command: (id) => commandStore.readCommand(id)
}

const openEditModal = async (
  resourceType: ResourceType,
  id: string,
  event: Event
): Promise<void> => {
  event.stopPropagation()

  const data = await readActions[resourceType](id)

  if (!data) {
    console.error(`無法讀取 ${resourceTitleMap[resourceType]} (id: ${id})，請確認後端是否正常運作`)
    return
  }

  editModal.value = {
    visible: true,
    mode: 'edit',
    title: `編輯 ${resourceTitleMap[resourceType]}`,
    initialName: data.name,
    initialContent: data.content,
    resourceType,
    itemId: id
  }
}

const handleOutputStyleEdit = (id: string, _name: string, event: Event): Promise<void> =>
  openEditModal('outputStyle', id, event)

const handleSubAgentEdit = (id: string, _name: string, event: Event): Promise<void> =>
  openEditModal('subAgent', id, event)

const handleCommandEdit = (id: string, _name: string, event: Event): Promise<void> =>
  openEditModal('command', id, event)

const handleCreateEditSubmit = async (payload: { name: string; content: string }): Promise<void> => {
  const { name, content } = payload
  const { mode, resourceType, itemId } = editModal.value

  if (mode === 'create') {
    const createActions = {
      outputStyle: async () => {
        const result = await outputStyleStore.createOutputStyle(name, content)
        if (result.success && result.outputStyle) {
          openMenuType.value = null
          emit('create-output-style-note', result.outputStyle.id)
          emit('close')
        }
      },
      subAgent: async () => {
        const result = await subAgentStore.createSubAgent(name, content)
        if (result.success && result.subAgent) {
          openMenuType.value = null
          emit('create-subagent-note', result.subAgent.id)
          emit('close')
        }
      },
      command: async () => {
        const result = await commandStore.createCommand(name, content)
        if (result.success && result.command) {
          openMenuType.value = null
          emit('create-command-note', result.command.id)
          emit('close')
        }
      }
    }

    await createActions[resourceType]()
  } else {
    const updateActions = {
      outputStyle: () => outputStyleStore.updateOutputStyle(itemId, content),
      subAgent: () => subAgentStore.updateSubAgent(itemId, content),
      command: () => commandStore.updateCommand(itemId, content)
    }

    await updateActions[resourceType]()
  }

  editModal.value.visible = false
}

const { menuStyle } = useMenuPosition({ position: computed(() => props.position) })
</script>

<template>
  <div>
    <!-- 背景遮罩 -->
    <div
      class="fixed inset-0 z-40"
      @click="handleClose"
    />

    <!-- 選單內容 -->
    <div
      class="fixed z-50 bg-card border-2 border-doodle-ink rounded-lg p-2 min-w-48"
      :style="menuStyle"
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
          <component
            :is="podTypes[0].icon"
            :size="16"
            class="text-card"
          />
        </span>
        <span class="font-mono text-sm text-foreground">Pod</span>
      </button>

      <!-- Output Styles 按鈕 -->
      <div
        class="relative"
        @mouseenter="openMenuType = 'outputStyle'"
        @mouseleave="openMenuType = null"
      >
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-pink)"
          >
            <Palette
              :size="16"
              class="text-card"
            />
          </span>
          <span class="font-mono text-sm text-foreground">Output Styles &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="outputStyleStore.availableItems"
          :visible="openMenuType === 'outputStyle'"
          @item-select="handleOutputStyleSelect"
          @item-edit="handleOutputStyleEdit"
          @item-delete="(id, name, event) => handleDeleteClick('outputStyle', id, name, event)"
        >
          <template #footer>
            <div class="border-t border-doodle-ink/30 my-1" />
            <div
              class="pod-menu-submenu-item flex items-center gap-2"
              @click="handleNewOutputStyle"
            >
              <FilePlus :size="16" />
              New...
            </div>
          </template>
        </PodTypeMenuSubmenu>
      </div>

      <!-- Command 按鈕 -->
      <div
        class="relative"
        @mouseenter="openMenuType = 'command'"
        @mouseleave="openMenuType = null"
      >
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-mint)"
          >
            <span class="text-xs text-card font-mono font-bold">/</span>
          </span>
          <span class="font-mono text-sm text-foreground">Commands &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="commandStore.availableItems"
          :visible="openMenuType === 'command'"
          @item-select="handleCommandSelect"
          @item-edit="handleCommandEdit"
          @item-delete="(id, name, event) => handleDeleteClick('command', id, name, event)"
        >
          <template #footer>
            <div class="border-t border-doodle-ink/30 my-1" />
            <div
              class="pod-menu-submenu-item flex items-center gap-2"
              @click="handleNewCommand"
            >
              <FilePlus :size="16" />
              New...
            </div>
          </template>
        </PodTypeMenuSubmenu>
      </div>

      <!-- Skills 按鈕 -->
      <div
        class="relative"
        @mouseenter="openMenuType = 'skill'"
        @mouseleave="openMenuType = null"
      >
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-green)"
          >
            <Wrench
              :size="16"
              class="text-card"
            />
          </span>
          <span class="font-mono text-sm text-foreground">Skills &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="skillStore.availableItems"
          :visible="openMenuType === 'skill'"
          :editable="false"
          @item-select="handleSkillSelect"
          @item-delete="(id, name, event) => handleDeleteClick('skill', id, name, event)"
        />
      </div>

      <!-- SubAgents 按鈕 -->
      <div
        class="relative"
        @mouseenter="openMenuType = 'subAgent'"
        @mouseleave="openMenuType = null"
      >
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-sand)"
          >
            <Bot
              :size="16"
              class="text-card"
            />
          </span>
          <span class="font-mono text-sm text-foreground">SubAgents &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="subAgentStore.availableItems"
          :visible="openMenuType === 'subAgent'"
          @item-select="handleSubAgentSelect"
          @item-edit="handleSubAgentEdit"
          @item-delete="(id, name, event) => handleDeleteClick('subAgent', id, name, event)"
        >
          <template #footer>
            <div class="border-t border-doodle-ink/30 my-1" />
            <div
              class="pod-menu-submenu-item flex items-center gap-2"
              @click="handleNewSubAgent"
            >
              <FilePlus :size="16" />
              New...
            </div>
          </template>
        </PodTypeMenuSubmenu>
      </div>

      <!-- Repository 按鈕 -->
      <div
        class="relative"
        @mouseenter="openMenuType = 'repository'"
        @mouseleave="openMenuType = null"
      >
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-secondary transition-colors text-left"
        >
          <span
            class="w-8 h-8 rounded-full flex items-center justify-center border border-doodle-ink"
            style="background-color: var(--doodle-orange)"
          >
            <FolderOpen
              :size="16"
              class="text-card"
            />
          </span>
          <span class="font-mono text-sm text-foreground">Repository &gt;</span>
        </button>

        <PodTypeMenuSubmenu
          v-model:hovered-item-id="hoveredItemId"
          :items="repositoryStore.availableItems"
          :visible="openMenuType === 'repository'"
          @item-select="handleRepositorySelect"
          @item-delete="(id, name, event) => handleDeleteClick('repository', id, name, event)"
        >
          <template #footer>
            <div class="border-t border-doodle-ink/30 my-1" />
            <div
              class="pod-menu-submenu-item flex items-center gap-2"
              @click="showCreateRepositoryModal = true"
            >
              <FolderPlus :size="16" />
              New...
            </div>
            <div
              class="pod-menu-submenu-item flex items-center gap-2"
              @click="showCloneRepositoryModal = true"
            >
              <Github :size="16" />
              Clone
            </div>
          </template>
        </PodTypeMenuSubmenu>
      </div>

    </div>

    <CreateRepositoryModal
      v-model:open="showCreateRepositoryModal"
      @created="handleRepositoryCreated"
    />

    <CloneRepositoryModal
      v-model:open="showCloneRepositoryModal"
      @clone-started="handleCloneStarted"
    />

    <ConfirmDeleteModal
      v-model:open="showDeleteModal"
      :item-name="deleteTarget?.name ?? ''"
      :is-in-use="isDeleteTargetInUse"
      :item-type="deleteTarget?.type ?? 'outputStyle'"
      @confirm="handleDeleteConfirm"
    />

    <CreateEditModal
      v-model:open="editModal.visible"
      :mode="editModal.mode"
      :title="editModal.title"
      :initial-name="editModal.initialName"
      :initial-content="editModal.initialContent"
      :name-editable="editModal.mode === 'create'"
      @submit="handleCreateEditSubmit"
    />
  </div>
</template>
