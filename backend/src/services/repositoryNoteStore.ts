import { GenericNoteStore } from './GenericNoteStore.js';
import type { RepositoryNote } from '../types/index.js';

class RepositoryNoteStoreImpl extends GenericNoteStore<RepositoryNote, 'repositoryId'> {
  constructor() {
    super({
      fileName: 'repository-notes.json',
      foreignKeyField: 'repositoryId',
      storeName: 'RepositoryNoteStore',
    });
  }

  findByRepositoryId(repositoryId: string): RepositoryNote[] {
    return this.findByForeignKey(repositoryId);
  }

  deleteByRepositoryId(repositoryId: string): string[] {
    return this.deleteByForeignKey(repositoryId);
  }
}

export const repositoryNoteStore = new RepositoryNoteStoreImpl();
