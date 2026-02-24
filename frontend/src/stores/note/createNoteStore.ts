import {defineStore} from 'pinia'
import type {BaseNote} from '@/types'
import {createWebSocketRequest} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {useDeleteItem} from '@/composables/useDeleteItem'
import {useCanvasStore} from '@/stores/canvasStore'
import {useToast} from '@/composables/useToast'

const STORE_TO_CATEGORY_MAP: Record<string, string> = {
    'skill': 'Skill',
    'repository': 'Repository',
    'subAgent': 'SubAgent',
    'command': 'Command',
    'outputStyle': 'OutputStyle'
}

interface Position {
    x: number
    y: number
}

interface BasePayload {
    requestId: string

    [key: string]: unknown
}

interface BaseResponse {
    requestId: string
    success: boolean

    [key: string]: unknown
}

export interface NoteStoreConfig<TItem> {
    storeName: string
    relationship: 'one-to-one' | 'one-to-many'
    responseItemsKey: string
    itemIdField: string
    events: {
        listItems: { request: string; response: string }
        listNotes: { request: string; response: string }
        createNote: { request: string; response: string }
        updateNote: { request: string; response: string }
        deleteNote: { request: string; response: string }
    }
    bindEvents?: {
        request: string
        response: string
    }
    unbindEvents?: {
        request: string
        response: string
    }
    deleteItemEvents?: {
        request: string
        response: string
    }
    groupEvents?: {
        listGroups: { request: string; response: string }
        createGroup: { request: string; response: string }
        updateGroup: { request: string; response: string }
        deleteGroup: { request: string; response: string }
        moveItemToGroup: { request: string; response: string }
    }
    createNotePayload: (item: TItem, x: number, y: number) => object
    getItemId: (item: TItem) => string
    getItemName: (item: TItem) => string
    customActions?: Record<string, (...args: unknown[]) => unknown>
}

interface GroupItem {
    id: string
    name: string
    [key: string]: unknown
}

interface NoteItem {
    id: string
    boundToPodId: string | null
    x: number
    y: number
    [key: string]: unknown
}

interface BaseNoteState {
    availableItems: unknown[]
    notes: NoteItem[]
    isLoading: boolean
    error: string | null
    draggedNoteId: string | null
    animatingNoteIds: Set<string>
    isDraggingNote: boolean
    isOverTrash: boolean
    groups: GroupItem[]
    expandedGroupIds: Set<string>
}

export function createNoteStore<TItem, TNote extends BaseNote>(
    config: NoteStoreConfig<TItem>
): ReturnType<typeof defineStore> {
    return defineStore(config.storeName, {
        state: (): BaseNoteState => ({
            availableItems: [],
            notes: [],
            isLoading: false,
            error: null,
            draggedNoteId: null,
            animatingNoteIds: new Set<string>(),
            isDraggingNote: false,
            isOverTrash: false,
            groups: [],
            expandedGroupIds: new Set<string>(),
        }),

        getters: {
            typedAvailableItems: (state): TItem[] => state.availableItems as TItem[],
            typedNotes: (state): TNote[] => state.notes as TNote[],

            getUnboundNotes: (state) =>
                state.notes.filter(note => note.boundToPodId === null),

            getNotesByPodId: (state) => (podId: string): TNote[] => {
                if (config.relationship === 'one-to-one') {
                    const note = state.notes.find(note => note.boundToPodId === podId)
                    return note ? [note] : []
                }
                return state.notes.filter(note => note.boundToPodId === podId)
            },

            getNoteById: (state) => (noteId: string): TNote | undefined =>
                state.notes.find(note => note.id === noteId),

            isNoteAnimating: (state) => (noteId: string): boolean =>
                state.animatingNoteIds.has(noteId),

            canDeleteDraggedNote: (state) => {
                if (state.draggedNoteId === null) return false
                const note = state.notes.find(n => n.id === state.draggedNoteId)
                return note?.boundToPodId === null
            },

            isItemInUse: (state) => (itemId: string): boolean =>
                state.notes.some(note => (note as Record<string, unknown>)[config.itemIdField] === itemId && note.boundToPodId !== null),

            isItemBoundToPod: (state) => (itemId: string, podId: string): boolean =>
                state.notes.some(note => (note as Record<string, unknown>)[config.itemIdField] === itemId && note.boundToPodId === podId),

            getGroupById: (state) => (groupId: string): GroupItem | undefined =>
                state.groups.find(group => group.id === groupId),

            getItemsByGroupId: (state) => (groupId: string | null): TItem[] =>
                state.availableItems.filter(item => (item as Record<string, unknown>).groupId === groupId) as TItem[],

            getRootItems: (state): TItem[] =>
                state.availableItems.filter(item => !(item as Record<string, unknown>).groupId) as TItem[],

            getSortedItemsWithGroups: (state): { groups: GroupItem[]; rootItems: TItem[] } => {
                const groups = [...state.groups].sort((a, b) => a.name.localeCompare(b.name))
                const rootItems = state.availableItems
                    .filter(item => !(item as Record<string, unknown>).groupId)
                    .sort((a, b) => config.getItemName(a as TItem).localeCompare(config.getItemName(b as TItem)))
                return {groups, rootItems: rootItems as TItem[]}
            },

            isGroupExpanded: (state) => (groupId: string): boolean =>
                state.expandedGroupIds.has(groupId),

            canDeleteGroup: (state) => (groupId: string): boolean =>
                !state.availableItems.some(item => (item as Record<string, unknown>).groupId === groupId),
        },

        actions: {
            async loadItems(): Promise<void> {
                this.isLoading = true
                this.error = null

                const {wrapWebSocketRequest} = useWebSocketErrorHandler()
                const canvasStore = useCanvasStore()

                if (!canvasStore.activeCanvasId) {
                    console.warn(`[${config.storeName}] Cannot load items: no active canvas`)
                    this.isLoading = false
                    return
                }

                const response = await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.listItems.request,
                        responseEvent: config.events.listItems.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId
                        }
                    })
                )

                this.isLoading = false

                if (!response) {
                    this.error = '載入失敗'
                    return
                }

                if (response[config.responseItemsKey]) {
                    this.availableItems = response[config.responseItemsKey] as unknown[]
                }
            },

            async loadNotesFromBackend(): Promise<void> {
                this.isLoading = true
                this.error = null

                const {wrapWebSocketRequest} = useWebSocketErrorHandler()
                const canvasStore = useCanvasStore()

                if (!canvasStore.activeCanvasId) {
                    console.warn(`[${config.storeName}] Cannot load notes: no active canvas`)
                    this.isLoading = false
                    return
                }

                const response = await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.listNotes.request,
                        responseEvent: config.events.listNotes.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId
                        }
                    })
                )

                this.isLoading = false

                if (!response) {
                    this.error = '載入失敗'
                    return
                }

                if (response.notes) {
                    this.notes = response.notes as unknown[]
                }
            },

            async createNote(itemId: string, x: number, y: number): Promise<void> {
                const item = this.availableItems.find(i => config.getItemId(i as TItem) === itemId)
                if (!item) return

                const itemName = config.getItemName(item as TItem)
                const canvasStore = useCanvasStore()

                if (!canvasStore.activeCanvasId) {
                    throw new Error('Cannot create note: no active canvas')
                }

                const payload = {
                    canvasId: canvasStore.activeCanvasId,
                    ...config.createNotePayload(item as TItem, x, y),
                    name: itemName,
                    x,
                    y,
                    boundToPodId: null,
                    originalPosition: null,
                }

                await createWebSocketRequest<BasePayload, BaseResponse>({
                    requestEvent: config.events.createNote.request,
                    responseEvent: config.events.createNote.response,
                    payload
                })
            },

            updateNotePositionLocal(noteId: string, x: number, y: number): void {
                const note = this.notes.find(n => n.id === noteId)
                if (!note) return
                note.x = x
                note.y = y
            },

            async updateNotePosition(noteId: string, x: number, y: number): Promise<void> {
                const note = this.notes.find(n => n.id === noteId)
                if (!note) return

                const originalX = note.x
                const originalY = note.y

                note.x = x
                note.y = y

                const {wrapWebSocketRequest} = useWebSocketErrorHandler()
                const canvasStore = useCanvasStore()

                const response = await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.updateNote.request,
                        responseEvent: config.events.updateNote.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            noteId,
                            x,
                            y,
                        }
                    })
                )

                if (!response) {
                    note.x = originalX
                    note.y = originalY
                    return
                }

                if (response.note) {
                    const index = this.notes.findIndex(n => n.id === noteId)
                    if (index !== -1) {
                        this.notes[index] = response.note
                    }
                }
            },

            setDraggedNote(noteId: string | null): void {
                this.draggedNoteId = noteId
            },

            setNoteAnimating(noteId: string, isAnimating: boolean): void {
                if (isAnimating) {
                    this.animatingNoteIds.add(noteId)
                } else {
                    this.animatingNoteIds.delete(noteId)
                }
            },

            setIsDraggingNote(isDragging: boolean): void {
                this.isDraggingNote = isDragging
            },

            setIsOverTrash(isOver: boolean): void {
                this.isOverTrash = isOver
            },

            async bindToPod(noteId: string, podId: string): Promise<void> {
                const note = this.notes.find(n => n.id === noteId)
                if (!note) return

                if (config.relationship === 'one-to-one') {
                    const existingNotes = this.getNotesByPodId(podId)
                    if (existingNotes.length > 0 && config.unbindEvents) {
                        await this.unbindFromPod!(podId, true)
                    }
                }

                const originalPosition = {x: note.x, y: note.y}

                if (!config.bindEvents) return

                const canvasStore = useCanvasStore()

                // 並行執行 bind 和 update
                await Promise.all([
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.bindEvents.request,
                        responseEvent: config.bindEvents.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            podId,
                            [config.itemIdField]: (note as Record<string, unknown>)[config.itemIdField]
                        }
                    }),
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.updateNote.request,
                        responseEvent: config.events.updateNote.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            noteId,
                            boundToPodId: podId,
                            originalPosition,
                        }
                    })
                ])
            },

            async unbindFromPod(podId: string, returnToOriginal: boolean = false, targetPosition?: Position): Promise<void> {
                if (!config.unbindEvents || config.relationship !== 'one-to-one') return

                const notes = this.getNotesByPodId(podId)
                const note = notes[0]
                if (!note) return

                const noteId = note.id

                const canvasStore = useCanvasStore()

                const updatePayload: Record<string, unknown> = {
                    canvasId: canvasStore.activeCanvasId!,
                    noteId,
                    boundToPodId: null,
                    originalPosition: null,
                }

                if (returnToOriginal && note.originalPosition) {
                    updatePayload.x = note.originalPosition.x
                    updatePayload.y = note.originalPosition.y
                } else if (targetPosition) {
                    updatePayload.x = targetPosition.x
                    updatePayload.y = targetPosition.y
                }

                // 並行執行 unbind 和 update
                await Promise.all([
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.unbindEvents.request,
                        responseEvent: config.unbindEvents.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            podId
                        }
                    }),
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.updateNote.request,
                        responseEvent: config.events.updateNote.response,
                        payload: updatePayload
                    })
                ])
            },

            async deleteNote(noteId: string): Promise<void> {
                const {wrapWebSocketRequest} = useWebSocketErrorHandler()
                const canvasStore = useCanvasStore()

                await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.deleteNote.request,
                        responseEvent: config.events.deleteNote.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            noteId,
                        }
                    })
                )
            },

            async deleteItem(itemId: string): Promise<void> {
                if (!config.deleteItemEvents) return

                const {deleteItem} = useDeleteItem()
                const canvasStore = useCanvasStore()
                const {showSuccessToast, showErrorToast} = useToast()

                const item = this.availableItems.find(i => config.getItemId(i as TItem) === itemId)
                const itemName = item ? config.getItemName(item as TItem) : undefined

                try {
                    await deleteItem<Record<string, unknown>, BaseResponse>({
                        requestEvent: config.deleteItemEvents.request,
                        responseEvent: config.deleteItemEvents.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            [config.itemIdField]: itemId
                        },
                        errorMessage: '刪除項目失敗',
                        onSuccess: (res) => {
                            const index = this.availableItems.findIndex(item => config.getItemId(item as TItem) === itemId)
                            if (index !== -1) {
                                this.availableItems.splice(index, 1)
                            }

                            if (res.deletedNoteIds) {
                                this.notes.splice(0, this.notes.length, ...this.notes.filter(note => !(res.deletedNoteIds as string[]).includes(note.id)))
                            }

                            const category = (STORE_TO_CATEGORY_MAP[config.storeName] || 'Note') as 'Skill' | 'Repository' | 'SubAgent' | 'Command' | 'OutputStyle' | 'Note'
                            showSuccessToast(category, '刪除成功', itemName)
                        }
                    })
                } catch (error) {
                    const category = (STORE_TO_CATEGORY_MAP[config.storeName] || 'Note') as 'Skill' | 'Repository' | 'SubAgent' | 'Command' | 'OutputStyle' | 'Note'
                    const message = error instanceof Error ? error.message : '未知錯誤'
                    showErrorToast(category, '刪除失敗', message)
                    throw error
                }
            },

            addNoteFromEvent(note: TNote): void {
                const exists = this.notes.some(n => n.id === note.id)
                if (!exists) {
                    this.notes.push(note)
                }
            },

            updateNoteFromEvent(note: TNote): void {
                const index = this.notes.findIndex(n => n.id === note.id)
                if (index !== -1) {
                    this.notes.splice(index, 1, note)
                }
            },

            removeNoteFromEvent(noteId: string): void {
                this.notes = this.notes.filter(n => n.id !== noteId)
            },

            addItemFromEvent(item: TItem): void {
                const exists = this.availableItems.some(i => config.getItemId(i as TItem) === config.getItemId(item))
                if (!exists) {
                    this.availableItems.push(item)
                }
            },

            removeItemFromEvent(itemId: string, deletedNoteIds?: string[]): void {
                this.availableItems = this.availableItems.filter(item => config.getItemId(item as TItem) !== itemId)

                if (deletedNoteIds) {
                    this.notes = this.notes.filter(note => !deletedNoteIds.includes(note.id))
                }
            },

            toggleGroupExpand(groupId: string): void {
                if (this.expandedGroupIds.has(groupId)) {
                    this.expandedGroupIds.delete(groupId)
                } else {
                    this.expandedGroupIds.add(groupId)
                }
            },

            addGroupFromEvent(group: Record<string, unknown>): void {
                const exists = this.groups.some(g => g.id === group.id)
                if (!exists) {
                    this.groups.push(group)
                }
            },

            updateGroupFromEvent(group: Record<string, unknown>): void {
                const index = this.groups.findIndex(g => g.id === group.id)
                if (index !== -1) {
                    this.groups.splice(index, 1, group)
                }
            },

            removeGroupFromEvent(groupId: string): void {
                this.groups = this.groups.filter(g => g.id !== groupId)
            },

            updateItemGroupId(itemId: string, groupId: string | null): void {
                const item = this.availableItems.find(i => config.getItemId(i as TItem) === itemId)
                if (item) {
                    (item as Record<string, unknown>).groupId = groupId
                }
            },

            ...((config.customActions ?? {}) as Record<string, (...args: unknown[]) => unknown>)
        },
    })
}
