import {defineStore} from 'pinia'
import type {SelectableElement, SelectionState} from '@/types'
import {POD_WIDTH, POD_HEIGHT, NOTE_WIDTH, NOTE_HEIGHT} from '@/lib/constants'

function isNoteInSelectionBox(
  noteX: number,
  noteY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): boolean {
  const noteMinX = noteX
  const noteMaxX = noteX + NOTE_WIDTH
  const noteMinY = noteY
  const noteMaxY = noteY + NOTE_HEIGHT

  return !(noteMaxX < minX || noteMinX > maxX || noteMaxY < minY || noteMinY > maxY)
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    isSelecting: false,
    box: null,
    selectedElements: [],
    boxSelectJustEnded: false,
    isCtrlMode: false,
    initialSelectedElements: [],
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

    /**
     * 檢查元素是否已選取
     */
    isElementSelected: (state) => (type: string, id: string): boolean => {
      return state.selectedElements.some(el => el.type === type && el.id === id)
    },
  },

  actions: {
    /**
     * 開始框選
     */
    startSelection(startX: number, startY: number, isCtrlPressed: boolean = false): void {
      this.isSelecting = true
      this.box = { startX, startY, endX: startX, endY: startY }
      this.isCtrlMode = isCtrlPressed

      if (isCtrlPressed) {
        this.initialSelectedElements = [...this.selectedElements]
      } else {
        this.selectedElements = []
        this.initialSelectedElements = []
      }
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
      this.isCtrlMode = false
      this.initialSelectedElements = []
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

    /**
     * Toggle 元素選取狀態
     */
    toggleElement(element: SelectableElement): void {
      const index = this.selectedElements.findIndex(
        el => el.type === element.type && el.id === element.id
      )

      if (index !== -1) {
        this.selectedElements.splice(index, 1)
      } else {
        this.selectedElements.push(element)
      }
    },

    /**
     * 加入元素到選取中
     */
    addElement(element: SelectableElement): void {
      const exists = this.selectedElements.some(
        el => el.type === element.type && el.id === element.id
      )

      if (!exists) {
        this.selectedElements.push(element)
      }
    },

    /**
     * 從選取中移除元素
     */
    removeElement(element: SelectableElement): void {
      this.selectedElements = this.selectedElements.filter(
        el => !(el.type === element.type && el.id === element.id)
      )
    },

    calculateSelectedElements(
      pods: Array<{id: string; x: number; y: number}>,
      outputStyleNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}>,
      skillNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}>,
      repositoryNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}> = [],
      subAgentNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}> = [],
      commandNotes: Array<{id: string; x: number; y: number; boundToPodId: string | null}> = []
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
          selected.push({ type: 'pod', id: pod.id })
        }
      }

      const noteTypes = [
        { notes: outputStyleNotes, type: 'outputStyleNote' as const },
        { notes: skillNotes, type: 'skillNote' as const },
        { notes: repositoryNotes, type: 'repositoryNote' as const },
        { notes: subAgentNotes, type: 'subAgentNote' as const },
        { notes: commandNotes, type: 'commandNote' as const }
      ]
      for (const { notes, type } of noteTypes) {
        for (const note of notes) {
          if (note.boundToPodId) continue
          if (isNoteInSelectionBox(note.x, note.y, minX, maxX, minY, maxY)) {
            selected.push({ type, id: note.id })
          }
        }
      }

      if (this.isCtrlMode) {
        const result = [...this.initialSelectedElements]

        for (const element of selected) {
          const index = result.findIndex(
            el => el.type === element.type && el.id === element.id
          )

          if (index !== -1) {
            result.splice(index, 1)
          } else {
            result.push(element)
          }
        }

        this.selectedElements = result
      } else {
        this.selectedElements = selected
      }
    },
  },
})
