import { ref } from 'vue'
import type { Ref } from 'vue'
import type { Group, McpServerConfig, Position } from '@/types'
import { screenToCanvasPosition } from '@/lib/canvasCoordinateUtils'

type ResourceType = 'outputStyle' | 'subAgent' | 'command'
type GroupType = 'outputStyleGroup' | 'subAgentGroup' | 'commandGroup'
type ExtendedResourceType = ResourceType | GroupType

interface EditModalState {
  visible: boolean
  mode: 'create' | 'edit'
  title: string
  initialName: string
  initialContent: string
  resourceType: ExtendedResourceType
  itemId: string
  showContent: boolean
}

interface McpServerModalState {
  visible: boolean
  mode: 'create' | 'edit'
  mcpServerId: string
  initialName: string
  initialConfig: McpServerConfig | undefined
}

export interface McpServerOperations {
  updateMcpServer: (id: string, name: string, config: McpServerConfig) => Promise<{ success: boolean; [key: string]: unknown }>
  createMcpServer: (name: string, config: McpServerConfig) => Promise<{ success: boolean; mcpServer?: { id: string } }>
  createNote: (id: string, x: number, y: number) => Promise<void>
}

interface ResourceStore {
  readOutputStyle?: (id: string) => Promise<{ id: string; name: string; content: string } | null>
  readSubAgent?: (id: string) => Promise<{ id: string; name: string; content: string } | null>
  readCommand?: (id: string) => Promise<{ id: string; name: string; content: string } | null>
  createOutputStyle?: (name: string, content: string) => Promise<{ success: boolean; outputStyle?: { id: string }; [key: string]: unknown }>
  createSubAgent?: (name: string, content: string) => Promise<{ success: boolean; subAgent?: { id: string }; [key: string]: unknown }>
  createCommand?: (name: string, content: string) => Promise<{ success: boolean; command?: { id: string }; [key: string]: unknown }>
  updateOutputStyle?: (id: string, content: string) => Promise<unknown>
  updateSubAgent?: (id: string, content: string) => Promise<unknown>
  updateCommand?: (id: string, content: string) => Promise<unknown>
  createNote: (id: string, x: number, y: number) => Promise<void>
  createGroup?: (name: string) => Promise<{ success: boolean; group?: Group; error?: string }>
}

type ResourceStoreMap = Record<ResourceType, ResourceStore>

interface EditModalStores {
  outputStyleStore: ResourceStore
  subAgentStore: ResourceStore
  commandStore: ResourceStore
  viewportStore: { offset: { x: number; y: number }; zoom: number }
}

const resourceTitleMap: Record<ResourceType, string> = {
  outputStyle: 'Output Style',
  subAgent: 'SubAgent',
  command: 'Command'
}

export function useEditModal(
  stores: EditModalStores,
  lastMenuPosition: Ref<Position | null>
): {
  editModal: Ref<EditModalState>
  mcpServerModal: Ref<McpServerModalState>
  handleOpenCreateModal: (resourceType: ResourceType, title: string) => void
  handleOpenCreateGroupModal: (groupType: GroupType, title: string) => void
  handleOpenEditModal: (resourceType: ResourceType, id: string) => Promise<void>
  handleCreate: (name: string, content: string) => Promise<void>
  handleUpdate: (name: string, content: string) => Promise<void>
  handleCreateEditSubmit: (payload: { name: string; content: string }) => Promise<void>
  closeEditModal: () => void
  handleOpenMcpServerModal: (mode: 'create' | 'edit', mcpServerId?: string) => void
  handleMcpServerModalSubmit: (payload: { name: string; config: McpServerConfig }, mcpServerStore: McpServerOperations) => Promise<void>
} {
  const { outputStyleStore, subAgentStore, commandStore, viewportStore } = stores

  const editModal = ref<EditModalState>({
    visible: false,
    mode: 'create',
    title: '',
    initialName: '',
    initialContent: '',
    resourceType: 'outputStyle',
    itemId: '',
    showContent: true
  })

  const mcpServerModal = ref<McpServerModalState>({
    visible: false,
    mode: 'create',
    mcpServerId: '',
    initialName: '',
    initialConfig: undefined
  })

  const resourceStoreMap: ResourceStoreMap = {
    outputStyle: outputStyleStore,
    subAgent: subAgentStore,
    command: commandStore
  }

  const readActions: Record<ResourceType, (id: string) => Promise<{ id: string; name: string; content: string } | null>> = {
    outputStyle: (id) => outputStyleStore.readOutputStyle!(id),
    subAgent: (id) => subAgentStore.readSubAgent!(id),
    command: (id) => commandStore.readCommand!(id)
  }

  function getCanvasPosition(): { x: number; y: number } | null {
    if (!lastMenuPosition.value) return null
    return screenToCanvasPosition(lastMenuPosition.value, viewportStore)
  }

  async function createResourceWithNote(
    name: string,
    content: string,
    createFn: (name: string, content: string) => Promise<{ success: boolean; [key: string]: unknown }>,
    storeKey: ResourceType
  ): Promise<void> {
    const result = await createFn(name, content)

    if (!result.success) return

    const resource = result[storeKey]
    if (!resource || typeof resource !== 'object' || !('id' in resource)) return

    const position = getCanvasPosition()
    if (!position) return

    const store = resourceStoreMap[storeKey]
    await store.createNote((resource as { id: string }).id, position.x, position.y)
  }

  function createItemAction(storeKey: ResourceType, name: string, content: string): () => Promise<void> {
    const store = resourceStoreMap[storeKey]
    const createFnMap: Record<ResourceType, ((n: string, c: string) => Promise<{ success: boolean; [key: string]: unknown }>) | undefined> = {
      outputStyle: store.createOutputStyle,
      subAgent: store.createSubAgent,
      command: store.createCommand
    }
    const createFn = createFnMap[storeKey]

    return () => createResourceWithNote(name, content, createFn!, storeKey)
  }

  function handleOpenCreateModal(resourceType: ResourceType, title: string): void {
    editModal.value = {
      visible: true,
      mode: 'create',
      title,
      initialName: '',
      initialContent: '',
      resourceType,
      itemId: '',
      showContent: true
    }
  }

  function handleOpenCreateGroupModal(groupType: GroupType, title: string): void {
    editModal.value = {
      visible: true,
      mode: 'create',
      title,
      initialName: '',
      initialContent: '',
      resourceType: groupType,
      itemId: '',
      showContent: false
    }
  }

  async function handleOpenEditModal(resourceType: ResourceType, id: string): Promise<void> {
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
      itemId: id,
      showContent: true
    }
  }

  async function handleUpdate(name: string, content: string): Promise<void> {
    const { resourceType, itemId } = editModal.value

    const updateActions: Partial<Record<ExtendedResourceType, () => Promise<unknown>>> = {
      outputStyle: () => outputStyleStore.updateOutputStyle!(itemId, content),
      subAgent: () => subAgentStore.updateSubAgent!(itemId, content),
      command: () => commandStore.updateCommand!(itemId, content)
    }

    const action = updateActions[resourceType]
    if (action) {
      await action()
    }

    editModal.value.visible = false
  }

  async function handleCreate(name: string, content: string): Promise<void> {
    const { resourceType } = editModal.value

    const createActions: Record<ExtendedResourceType, () => Promise<void | { success: boolean; group?: Group; error?: string }>> = {
      outputStyle: createItemAction('outputStyle', name, content),
      subAgent: createItemAction('subAgent', name, content),
      command: createItemAction('command', name, content),
      outputStyleGroup: () => outputStyleStore.createGroup!(name),
      subAgentGroup: () => subAgentStore.createGroup!(name),
      commandGroup: () => commandStore.createGroup!(name)
    }

    await createActions[resourceType]()
    editModal.value.visible = false
  }

  async function handleCreateEditSubmit(payload: { name: string; content: string }): Promise<void> {
    const { name, content } = payload

    if (editModal.value.mode === 'edit') {
      await handleUpdate(name, content)
      return
    }

    await handleCreate(name, content)
  }

  function closeEditModal(): void {
    editModal.value.visible = false
  }

  function handleOpenMcpServerModal(mode: 'create' | 'edit', mcpServerId?: string): void {
    mcpServerModal.value = {
      visible: true,
      mode,
      mcpServerId: mcpServerId ?? '',
      initialName: '',
      initialConfig: undefined
    }
  }

  async function handleMcpServerModalSubmit(
    payload: { name: string; config: McpServerConfig },
    mcpServerStore: McpServerOperations
  ): Promise<void> {
    const { name, config } = payload
    const { mode, mcpServerId } = mcpServerModal.value

    if (mode === 'edit') {
      await mcpServerStore.updateMcpServer(mcpServerId, name, config)
      mcpServerModal.value.visible = false
      return
    }

    const result = await mcpServerStore.createMcpServer(name, config)

    if (!result.success || !lastMenuPosition.value) {
      mcpServerModal.value.visible = false
      return
    }

    if (result.mcpServer) {
      const position = getCanvasPosition()
      if (position) {
        await mcpServerStore.createNote(result.mcpServer.id, position.x, position.y)
      }
    }

    mcpServerModal.value.visible = false
  }

  return {
    editModal,
    mcpServerModal,
    handleOpenCreateModal,
    handleOpenCreateGroupModal,
    handleOpenEditModal,
    handleCreate,
    handleUpdate,
    handleCreateEditSubmit,
    closeEditModal,
    handleOpenMcpServerModal,
    handleMcpServerModalSubmit
  }
}
