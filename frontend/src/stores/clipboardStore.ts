import { defineStore } from 'pinia'
import type { CopiedPod, CopiedOutputStyleNote, CopiedSkillNote, CopiedRepositoryNote, CopiedSubAgentNote, CopiedConnection } from '@/types'

interface ClipboardState {
  copiedPods: CopiedPod[]
  copiedOutputStyleNotes: CopiedOutputStyleNote[]
  copiedSkillNotes: CopiedSkillNote[]
  copiedRepositoryNotes: CopiedRepositoryNote[]
  copiedSubAgentNotes: CopiedSubAgentNote[]
  copiedConnections: CopiedConnection[]
  copyTimestamp: number | null
}

export const useClipboardStore = defineStore('clipboard', {
  state: (): ClipboardState => ({
    copiedPods: [],
    copiedOutputStyleNotes: [],
    copiedSkillNotes: [],
    copiedRepositoryNotes: [],
    copiedSubAgentNotes: [],
    copiedConnections: [],
    copyTimestamp: null,
  }),

  getters: {
    isEmpty: (state): boolean =>
      state.copiedPods.length === 0 &&
      state.copiedOutputStyleNotes.length === 0 &&
      state.copiedSkillNotes.length === 0 &&
      state.copiedRepositoryNotes.length === 0 &&
      state.copiedSubAgentNotes.length === 0 &&
      state.copiedConnections.length === 0,

    hasCopiedData: (state): boolean =>
      state.copiedPods.length > 0 ||
      state.copiedOutputStyleNotes.length > 0 ||
      state.copiedSkillNotes.length > 0 ||
      state.copiedRepositoryNotes.length > 0 ||
      state.copiedSubAgentNotes.length > 0 ||
      state.copiedConnections.length > 0,
  },

  actions: {
    setCopy(
      pods: CopiedPod[],
      outputStyleNotes: CopiedOutputStyleNote[],
      skillNotes: CopiedSkillNote[],
      repositoryNotes: CopiedRepositoryNote[],
      subAgentNotes: CopiedSubAgentNote[],
      connections: CopiedConnection[]
    ): void {
      this.copiedPods = pods
      this.copiedOutputStyleNotes = outputStyleNotes
      this.copiedSkillNotes = skillNotes
      this.copiedRepositoryNotes = repositoryNotes
      this.copiedSubAgentNotes = subAgentNotes
      this.copiedConnections = connections
      this.copyTimestamp = Date.now()
    },

    clear(): void {
      this.copiedPods = []
      this.copiedOutputStyleNotes = []
      this.copiedSkillNotes = []
      this.copiedRepositoryNotes = []
      this.copiedSubAgentNotes = []
      this.copiedConnections = []
      this.copyTimestamp = null
    },

    getCopiedData(): {
      pods: CopiedPod[]
      outputStyleNotes: CopiedOutputStyleNote[]
      skillNotes: CopiedSkillNote[]
      repositoryNotes: CopiedRepositoryNote[]
      subAgentNotes: CopiedSubAgentNote[]
      connections: CopiedConnection[]
    } {
      return {
        pods: this.copiedPods,
        outputStyleNotes: this.copiedOutputStyleNotes,
        skillNotes: this.copiedSkillNotes,
        repositoryNotes: this.copiedRepositoryNotes,
        subAgentNotes: this.copiedSubAgentNotes,
        connections: this.copiedConnections,
      }
    },
  },
})
