import { createNoteStore } from './GenericNoteStore.js';
import type { OutputStyleNote, SkillNote, RepositoryNote, SubAgentNote, CommandNote } from '../types/index.js';

export const noteStore = createNoteStore<OutputStyleNote, 'outputStyleId'>({
  fileName: 'notes.json',
  foreignKeyField: 'outputStyleId',
  storeName: 'NoteStore',
});

export const skillNoteStore = createNoteStore<SkillNote, 'skillId'>({
  fileName: 'skill-notes.json',
  foreignKeyField: 'skillId',
  storeName: 'SkillNoteStore',
});

export const repositoryNoteStore = createNoteStore<RepositoryNote, 'repositoryId'>({
  fileName: 'repository-notes.json',
  foreignKeyField: 'repositoryId',
  storeName: 'RepositoryNoteStore',
});

export const subAgentNoteStore = createNoteStore<SubAgentNote, 'subAgentId'>({
  fileName: 'subagent-notes.json',
  foreignKeyField: 'subAgentId',
  storeName: 'SubAgentNoteStore',
});

export const commandNoteStore = createNoteStore<CommandNote, 'commandId'>({
  fileName: 'command-notes.json',
  foreignKeyField: 'commandId',
  storeName: 'CommandNoteStore',
});
