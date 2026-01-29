import { GenericNoteStore } from './GenericNoteStore.js';
import type { CommandNote } from '../types/index.js';

class CommandNoteStore extends GenericNoteStore<CommandNote, 'commandId'> {
  constructor() {
    super({
      fileName: 'command-notes.json',
      foreignKeyField: 'commandId',
      storeName: 'CommandNoteStore',
    });
  }

  findByCommandId(commandId: string): CommandNote[] {
    return this.findByForeignKey(commandId);
  }

  deleteByCommandId(commandId: string): string[] {
    return this.deleteByForeignKey(commandId);
  }
}

export const commandNoteStore = new CommandNoteStore();
