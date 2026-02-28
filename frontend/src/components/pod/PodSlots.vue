<script setup lang="ts">
import type { OutputStyleNote, SkillNote, SubAgentNote, RepositoryNote, CommandNote, McpServerNote } from '@/types'
import PodOutputStyleSlot from '@/components/pod/PodOutputStyleSlot.vue'
import PodSkillSlot from '@/components/pod/PodSkillSlot.vue'
import PodSubAgentSlot from '@/components/pod/PodSubAgentSlot.vue'
import PodRepositorySlot from '@/components/pod/PodRepositorySlot.vue'
import PodCommandSlot from '@/components/pod/PodCommandSlot.vue'
import PodMcpServerSlot from '@/components/pod/PodMcpServerSlot.vue'

const {
  podId,
  podRotation,
  boundOutputStyleNote,
  boundSkillNotes,
  boundSubAgentNotes,
  boundRepositoryNote,
  boundCommandNote,
  boundMcpServerNotes
} = defineProps<{
  podId: string
  podRotation: number
  boundOutputStyleNote: OutputStyleNote | undefined
  boundSkillNotes: SkillNote[]
  boundSubAgentNotes: SubAgentNote[]
  boundRepositoryNote: RepositoryNote | undefined
  boundCommandNote: CommandNote | undefined
  boundMcpServerNotes: McpServerNote[]
}>()

const emit = defineEmits<{
  'output-style-dropped': [noteId: string]
  'output-style-removed': []
  'skill-dropped': [noteId: string]
  'subagent-dropped': [noteId: string]
  'repository-dropped': [noteId: string]
  'repository-removed': []
  'command-dropped': [noteId: string]
  'command-removed': []
  'mcp-server-dropped': [noteId: string]
}>()

const handleOutputStyleDropped = (noteId: string): void => {
  emit('output-style-dropped', noteId)
}

const handleOutputStyleRemoved = (): void => {
  emit('output-style-removed')
}

const handleSkillDropped = (noteId: string): void => {
  emit('skill-dropped', noteId)
}

const handleSubAgentDropped = (noteId: string): void => {
  emit('subagent-dropped', noteId)
}

const handleRepositoryDropped = (noteId: string): void => {
  emit('repository-dropped', noteId)
}

const handleRepositoryRemoved = (): void => {
  emit('repository-removed')
}

const handleCommandDropped = (noteId: string): void => {
  emit('command-dropped', noteId)
}

const handleCommandRemoved = (): void => {
  emit('command-removed')
}

const handleMcpServerDropped = (noteId: string): void => {
  emit('mcp-server-dropped', noteId)
}
</script>

<template>
  <!-- Output Style 凹槽 -->
  <div class="pod-notch-area-base pod-notch-area">
    <PodOutputStyleSlot
      :pod-id="podId"
      :bound-note="boundOutputStyleNote"
      :pod-rotation="podRotation"
      @note-dropped="handleOutputStyleDropped"
      @note-removed="handleOutputStyleRemoved"
    />
  </div>

  <!-- Skill 凹槽 -->
  <div class="pod-notch-area-base pod-skill-notch-area">
    <PodSkillSlot
      :pod-id="podId"
      :bound-notes="boundSkillNotes"
      @note-dropped="handleSkillDropped"
    />
  </div>

  <!-- SubAgent 凹槽 -->
  <div class="pod-notch-area-base pod-subagent-notch-area">
    <PodSubAgentSlot
      :pod-id="podId"
      :bound-notes="boundSubAgentNotes"
      @note-dropped="handleSubAgentDropped"
    />
  </div>

  <!-- Repository 凹槽（右側） -->
  <div class="pod-notch-area-base pod-repository-notch-area">
    <PodRepositorySlot
      :pod-id="podId"
      :bound-note="boundRepositoryNote"
      :pod-rotation="podRotation"
      @note-dropped="handleRepositoryDropped"
      @note-removed="handleRepositoryRemoved"
    />
  </div>

  <!-- Command 插槽（右側） -->
  <div class="pod-notch-area-base pod-command-notch-area">
    <PodCommandSlot
      :pod-id="podId"
      :bound-note="boundCommandNote"
      :pod-rotation="podRotation"
      @note-dropped="handleCommandDropped"
      @note-removed="handleCommandRemoved"
    />
  </div>

  <!-- MCP Server 凹槽 -->
  <div class="pod-notch-area-base pod-mcp-server-notch-area">
    <PodMcpServerSlot
      :pod-id="podId"
      :bound-notes="boundMcpServerNotes"
      @note-dropped="handleMcpServerDropped"
    />
  </div>
</template>
