import {defineStore} from 'pinia'
import type {SelectableElement, SelectionBox} from '@/types'
import {POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT} from '@/lib/constants'

interface SelectionState {
  isSelecting: boolean
  box: SelectionBox | null
  selectedElements: SelectableElement[]
  boxSelectJustEnded: boolean
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    isSelecting: false,
    box: null,
    selectedElements: [],
    boxSelectJustEnded: false,
  }),

  getters: {
    /**
     * 取得選中的 Pod ID 列表
     */
    selectedPodIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'pod')
        .map(el => el.id),

    /**
     * 取得選中的 OutputStyleNote ID 列表
     */
    selectedOutputStyleNoteIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'outputStyleNote')
        .map(el => el.id),

    /**
     * 取得選中的 SkillNote ID 列表
     */
    selectedSkillNoteIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'skillNote')
        .map(el => el.id),

    /**
     * 取得選中的 RepositoryNote ID 列表
     */
    selectedRepositoryNoteIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'repositoryNote')
        .map(el => el.id),

    /**
     * 取得選中的 SubAgentNote ID 列表
     */
    selectedSubAgentNoteIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'subAgentNote')
        .map(el => el.id),

    /**
     * 取得選中的 CommandNote ID 列表
     */
    selectedCommandNoteIds: (state): string[] =>
      state.selectedElements
        .filter(el => el.type === 'commandNote')
        .map(el => el.id),

    /**
     * 是否有選中的元素
     */
    hasSelection: (state): boolean => state.selectedElements.length > 0,
  },

  actions: {
    /**
     * 開始框選
     */
    startSelection(startX: number, startY: number): void {
      this.isSelecting = true
      this.box = { startX, startY, endX: startX, endY: startY }
      this.selectedElements = []
    },

    /**
     * 更新框選範圍
     */
    updateSelection(endX: number, endY: number): void {
      if (!this.box) return
      this.box.endX = endX
      this.box.endY = endY
    },

    /**
     * 結束框選
     */
    endSelection(): void {
      this.isSelecting = false
      this.box = null
      this.boxSelectJustEnded = true
      requestAnimationFrame(() => {
        this.boxSelectJustEnded = false
      })
    },

    /**
     * 清除選取狀態
     */
    clearSelection(): void {
      this.isSelecting = false
      this.box = null
      this.selectedElements = []
    },

    /**
     * 設定選中的元素
     */
    setSelectedElements(elements: SelectableElement[]): void {
      this.selectedElements = elements
    },

    calculateSelectedElements(
      pods: Array<{id: string; x: number; y: number}>,
      outputStyleNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}>,
      skillNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}>,
      repositoryNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}> = [],
      subAgentNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}> = []
    ): void {
      if (!this.box) return

      const box = this.box
      const minX = Math.min(box.startX, box.endX)
      const maxX = Math.max(box.startX, box.endX)
      const minY = Math.min(box.startY, box.endY)
      const maxY = Math.max(box.startY, box.endY)

      const selected: SelectableElement[] = []

      for (const pod of pods) {
        const podMinX = pod.x
        const podMaxX = pod.x + POD_WIDTH
        const podMinY = pod.y
        const podMaxY = pod.y + POD_HEIGHT

        const hasIntersection = !(podMaxX < minX || podMinX > maxX || podMaxY < minY || podMinY > maxY)

        if (hasIntersection) {
          selected.push({type: 'pod', id: pod.id})
        }
      }

      for (const note of outputStyleNotes) {
        if (note.boundToPodId) continue

        const noteMinX = note.x
        const noteMaxX = note.x + NOTE_WIDTH
        const noteMinY = note.y
        const noteMaxY = note.y + NOTE_HEIGHT

        const hasIntersection = !(noteMaxX < minX || noteMinX > maxX || noteMaxY < minY || noteMinY > maxY)

        if (hasIntersection) {
          selected.push({type: 'outputStyleNote', id: note.id})
        }
      }

      for (const note of skillNotes) {
        if (note.boundToPodId) continue

        const noteMinX = note.x
        const noteMaxX = note.x + NOTE_WIDTH
        const noteMinY = note.y
        const noteMaxY = note.y + NOTE_HEIGHT

        const hasIntersection = !(noteMaxX < minX || noteMinX > maxX || noteMaxY < minY || noteMinY > maxY)

        if (hasIntersection) {
          selected.push({type: 'skillNote', id: note.id})
        }
      }

      for (const note of repositoryNotes) {
        if (note.boundToPodId) continue

        const noteMinX = note.x
        const noteMaxX = note.x + NOTE_WIDTH
        const noteMinY = note.y
        const noteMaxY = note.y + NOTE_HEIGHT

        const hasIntersection = !(noteMaxX < minX || noteMinX > maxX || noteMaxY < minY || noteMinY > maxY)

        if (hasIntersection) {
          selected.push({type: 'repositoryNote', id: note.id})
        }
      }

      for (const note of subAgentNotes) {
        if (note.boundToPodId) continue

        const noteMinX = note.x
        const noteMaxX = note.x + NOTE_WIDTH
        const noteMinY = note.y
        const noteMaxY = note.y + NOTE_HEIGHT

        const hasIntersection = !(noteMaxX < minX || noteMinX > maxX || noteMaxY < minY || noteMinY > maxY)

        if (hasIntersection) {
          selected.push({type: 'subAgentNote', id: note.id})
        }
      }

      this.selectedElements = selected
    },
  },
})
