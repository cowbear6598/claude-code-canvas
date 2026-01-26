import { defineStore } from 'pinia'
import type { CopiedPod, CopiedOutputStyleNote, CopiedSkillNote, CopiedConnection } from '@/types'

interface ClipboardState {
  copiedPods: CopiedPod[]
  copiedOutputStyleNotes: CopiedOutputStyleNote[]
  copiedSkillNotes: CopiedSkillNote[]
  copiedConnections: CopiedConnection[]
  copyTimestamp: number | null
}

export const useClipboardStore = defineStore('clipboard', {
  state: (): ClipboardState => ({
    copiedPods: [],
    copiedOutputStyleNotes: [],
    copiedSkillNotes: [],
    copiedConnections: [],
    copyTimestamp: null,
  }),

  getters: {
    isEmpty: (state): boolean =>
      state.copiedPods.length === 0 &&
      state.copiedOutputStyleNotes.length === 0 &&
      state.copiedSkillNotes.length === 0 &&
      state.copiedConnections.length === 0,

    hasCopiedData: (state): boolean =>
      state.copiedPods.length > 0 ||
      state.copiedOutputStyleNotes.length > 0 ||
      state.copiedSkillNotes.length > 0 ||
      state.copiedConnections.length > 0,
  },

  actions: {
    setCopy(
      pods: CopiedPod[],
      outputStyleNotes: CopiedOutputStyleNote[],
      skillNotes: CopiedSkillNote[],
      connections: CopiedConnection[]
    ): void {
      this.copiedPods = pods
      this.copiedOutputStyleNotes = outputStyleNotes
      this.copiedSkillNotes = skillNotes
      this.copiedConnections = connections
      this.copyTimestamp = Date.now()
    },

    clear(): void {
      this.copiedPods = []
      this.copiedOutputStyleNotes = []
      this.copiedSkillNotes = []
      this.copiedConnections = []
      this.copyTimestamp = null
    },

    getCopiedData(): {
      pods: CopiedPod[]
      outputStyleNotes: CopiedOutputStyleNote[]
      skillNotes: CopiedSkillNote[]
      connections: CopiedConnection[]
    } {
      return {
        pods: this.copiedPods,
        outputStyleNotes: this.copiedOutputStyleNotes,
        skillNotes: this.copiedSkillNotes,
        connections: this.copiedConnections,
      }
    },
  },
})
