import { GenericNoteStore } from './GenericNoteStore.js';
import type { SkillNote } from '../types/index.js';

class SkillNoteStoreImpl extends GenericNoteStore<SkillNote, 'skillId'> {
  constructor() {
    super({
      fileName: 'skill-notes.json',
      foreignKeyField: 'skillId',
      storeName: 'SkillNoteStore',
    });
  }

  findBySkillId(skillId: string): SkillNote[] {
    return this.findByForeignKey(skillId);
  }

  deleteBySkillId(skillId: string): string[] {
    return this.deleteByForeignKey(skillId);
  }
}

export const skillNoteStore = new SkillNoteStoreImpl();
