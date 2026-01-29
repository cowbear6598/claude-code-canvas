<script setup lang="ts">
import type { OutputStyleNote, SkillNote, SubAgentNote, RepositoryNote, CommandNote } from '@/types'
import PodOutputStyleSlot from '@/components/pod/PodOutputStyleSlot.vue'
import PodSkillSlot from '@/components/pod/PodSkillSlot.vue'
import PodSubAgentSlot from '@/components/pod/PodSubAgentSlot.vue'
import PodRepositorySlot from '@/components/pod/PodRepositorySlot.vue'
import PodCommandSlot from '@/components/pod/PodCommandSlot.vue'

const props = defineProps<{
  podId: string
  podRotation: number
  boundOutputStyleNote: OutputStyleNote | undefined
  boundSkillNotes: SkillNote[]
  boundSubAgentNotes: SubAgentNote[]
  boundRepositoryNote: RepositoryNote | undefined
  boundCommandNote: CommandNote | undefined
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
}>()

const handleOutputStyleDropped = (noteId: string) => {
  emit('output-style-dropped', noteId)
}

const handleOutputStyleRemoved = () => {
  emit('output-style-removed')
}

const handleSkillDropped = (noteId: string) => {
  emit('skill-dropped', noteId)
}

const handleSubAgentDropped = (noteId: string) => {
  emit('subagent-dropped', noteId)
}

const handleRepositoryDropped = (noteId: string) => {
  emit('repository-dropped', noteId)
}

const handleRepositoryRemoved = () => {
  emit('repository-removed')
}

const handleCommandDropped = (noteId: string) => {
  emit('command-dropped', noteId)
}

const handleCommandRemoved = () => {
  emit('command-removed')
}
</script>

<template>
  <!-- Output Style 凹槽 -->
  <div class="pod-notch-area">
    <PodOutputStyleSlot
      :pod-id="podId"
      :bound-note="boundOutputStyleNote"
      :pod-rotation="podRotation"
      @note-dropped="handleOutputStyleDropped"
      @note-removed="handleOutputStyleRemoved"
    />
  </div>

  <!-- Skill 凹槽 -->
  <div class="pod-skill-notch-area">
    <PodSkillSlot
      :pod-id="podId"
      :bound-notes="boundSkillNotes"
      @note-dropped="handleSkillDropped"
    />
  </div>

  <!-- SubAgent 凹槽 -->
  <div class="pod-subagent-notch-area">
    <PodSubAgentSlot
      :pod-id="podId"
      :bound-notes="boundSubAgentNotes"
      @note-dropped="handleSubAgentDropped"
    />
  </div>

  <!-- Repository 凹槽（右側） -->
  <div class="pod-repository-notch-area">
    <PodRepositorySlot
      :pod-id="podId"
      :bound-note="boundRepositoryNote"
      :pod-rotation="podRotation"
      @note-dropped="handleRepositoryDropped"
      @note-removed="handleRepositoryRemoved"
    />
  </div>

  <!-- Command 凹槽（右側，Repository 下方） -->
  <div class="pod-command-notch-area">
    <PodCommandSlot
      :pod-id="podId"
      :bound-note="boundCommandNote"
      :pod-rotation="podRotation"
      @note-dropped="handleCommandDropped"
      @note-removed="handleCommandRemoved"
    />
  </div>
</template>
