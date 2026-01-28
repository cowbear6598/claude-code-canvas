import { GenericNoteStore } from './GenericNoteStore.js';
import type { SubAgentNote } from '../types/index.js';

class SubAgentNoteStoreImpl extends GenericNoteStore<SubAgentNote, 'subAgentId'> {
  constructor() {
    super({
      fileName: 'subagent-notes.json',
      foreignKeyField: 'subAgentId',
      storeName: 'SubAgentNoteStore',
    });
  }

  findBySubAgentId(subAgentId: string): SubAgentNote[] {
    return this.findByForeignKey(subAgentId);
  }

  deleteBySubAgentId(subAgentId: string): string[] {
    return this.deleteByForeignKey(subAgentId);
  }
}

export const subAgentNoteStore = new SubAgentNoteStoreImpl();
