import { GenericNoteStore } from './GenericNoteStore.js';
import type { OutputStyleNote } from '../types/index.js';

class NoteStoreImpl extends GenericNoteStore<OutputStyleNote, 'outputStyleId'> {
  constructor() {
    super({
      fileName: 'notes.json',
      foreignKeyField: 'outputStyleId',
      storeName: 'NoteStore',
    });
  }

  findByOutputStyleId(outputStyleId: string): OutputStyleNote[] {
    return this.findByForeignKey(outputStyleId);
  }

  deleteByOutputStyleId(outputStyleId: string): string[] {
    return this.deleteByForeignKey(outputStyleId);
  }
}

export const noteStore = new NoteStoreImpl();
