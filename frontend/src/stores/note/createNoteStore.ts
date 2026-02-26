import {defineStore} from 'pinia'
import type {BaseNote, Pod} from '@/types'
import {createWebSocketRequest} from '@/services/websocket'
import {useWebSocketErrorHandler} from '@/composables/useWebSocketErrorHandler'
import {useDeleteItem} from '@/composables/useDeleteItem'
import {useCanvasStore} from '@/stores/canvasStore'
import {useToast} from '@/composables/useToast'
import {requireActiveCanvas, getActiveCanvasIdOrWarn} from '@/utils/canvasGuard'
import {createNoteBindingActions} from './noteBindingActions'
import {createNotePositionActions} from './notePositionActions'

const STORE_TO_CATEGORY_MAP: Record<string, string> = {
    'skill': 'Skill',
    'repository': 'Repository',
    'subAgent': 'SubAgent',
    'command': 'Command',
    'outputStyle': 'OutputStyle'
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
        listGroups?: { request: string; response: string }
        createGroup?: { request: string; response: string }
        deleteGroup?: { request: string; response: string }
        moveItemToGroup: { request: string; response: string }
    }
    createNotePayload: (item: TItem, x: number, y: number) => object
    getItemId: (item: TItem) => string
    getItemName: (item: TItem) => string
    customActions?: Record<string, (...args: unknown[]) => unknown>
}

export interface RebuildNotesConfig {
    storeName: string
    podIdField: keyof Pod
    itemIdField: string
    yOffset: number
    requestEvent: string
    responseEvent: string
}

interface RebuildNotesStoreContext {
    notes: NoteItem[]
    availableItems: unknown[]
    getNotesByPodId: (podId: string) => NoteItem[]
}

export async function rebuildNotesFromPods(
    context: RebuildNotesStoreContext,
    pods: Pod[],
    config: RebuildNotesConfig
): Promise<void> {
    const canvasId = getActiveCanvasIdOrWarn(config.storeName)
    if (!canvasId) return

    const promises: Promise<void>[] = []

    for (const pod of pods) {
        const itemId = pod[config.podIdField] as string | null | undefined
        if (!itemId) continue

        const existingNotes = context.getNotesByPodId(pod.id)
        if (existingNotes.length > 0) continue

        const item = context.availableItems.find(
            (i) => (i as Record<string, unknown>).id === itemId
        )
        const itemName = (item as Record<string, unknown> | undefined)?.name as string | undefined ?? itemId

        const promise = createWebSocketRequest<Record<string, unknown>, Record<string, unknown>>({
            requestEvent: config.requestEvent,
            responseEvent: config.responseEvent,
            payload: {
                canvasId,
                [config.itemIdField]: itemId,
                name: itemName,
                x: pod.x,
                y: pod.y + config.yOffset,
                boundToPodId: pod.id,
                originalPosition: { x: pod.x, y: pod.y + config.yOffset },
            }
        }).then(response => {
            if (response.note) {
                context.notes.push(response.note as NoteItem)
            }
        })

        promises.push(promise)
    }

    if (promises.length > 0) {
        await Promise.all(promises)
    }
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
                const canvasId = getActiveCanvasIdOrWarn(config.storeName)

                if (!canvasId) {
                    this.isLoading = false
                    return
                }

                const response = await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.listItems.request,
                        responseEvent: config.events.listItems.response,
                        payload: {
                            canvasId
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
                const canvasId = getActiveCanvasIdOrWarn(config.storeName)

                if (!canvasId) {
                    this.isLoading = false
                    return
                }

                const response = await wrapWebSocketRequest(
                    createWebSocketRequest<BasePayload, BaseResponse>({
                        requestEvent: config.events.listNotes.request,
                        responseEvent: config.events.listNotes.response,
                        payload: {
                            canvasId
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
                const canvasId = requireActiveCanvas()

                const payload = {
                    canvasId,
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

            ...createNotePositionActions(config),

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

            ...createNoteBindingActions(config),

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
                const category = (STORE_TO_CATEGORY_MAP[config.storeName] || 'Note') as 'Skill' | 'Repository' | 'SubAgent' | 'Command' | 'OutputStyle' | 'Note'

                const removeItemFromState = (res: BaseResponse): void => {
                    const index = this.availableItems.findIndex(i => config.getItemId(i as TItem) === itemId)
                    if (index !== -1) {
                        this.availableItems.splice(index, 1)
                    }
                    if (res.deletedNoteIds) {
                        const deletedIds = res.deletedNoteIds as string[]
                        this.notes.splice(0, this.notes.length, ...this.notes.filter(note => !deletedIds.includes(note.id)))
                    }
                    showSuccessToast(category, '刪除成功', itemName)
                }

                try {
                    await deleteItem<Record<string, unknown>, BaseResponse>({
                        requestEvent: config.deleteItemEvents.request,
                        responseEvent: config.deleteItemEvents.response,
                        payload: {
                            canvasId: canvasStore.activeCanvasId!,
                            [config.itemIdField]: itemId
                        },
                        errorMessage: '刪除項目失敗',
                        onSuccess: removeItemFromState
                    })
                } catch (error) {
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
