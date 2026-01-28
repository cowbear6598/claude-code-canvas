import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { RepositoryNote } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';

interface CreateRepositoryNoteData {
  repositoryId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

class RepositoryNoteStore {
  private notes: Map<string, RepositoryNote> = new Map();
  private readonly notesFilePath: string;

  constructor() {
    this.notesFilePath = path.join(config.canvasRoot, 'data', 'repository-notes.json');
  }

  create(data: CreateRepositoryNoteData): RepositoryNote {
    const id = uuidv4();

    const note: RepositoryNote = {
      id,
      repositoryId: data.repositoryId,
      name: data.name,
      x: data.x,
      y: data.y,
      boundToPodId: data.boundToPodId,
      originalPosition: data.originalPosition,
    };

    this.notes.set(id, note);
    this.saveToDiskAsync();

    return note;
  }

  getById(id: string): RepositoryNote | undefined {
    return this.notes.get(id);
  }

  list(): RepositoryNote[] {
    return Array.from(this.notes.values());
  }

  update(id: string, updates: Partial<Omit<RepositoryNote, 'id'>>): RepositoryNote | undefined {
    const note = this.notes.get(id);
    if (!note) {
      return undefined;
    }

    const updatedNote = { ...note, ...updates };
    this.notes.set(id, updatedNote);
    this.saveToDiskAsync();

    return updatedNote;
  }

  delete(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  findByBoundPodId(podId: string): RepositoryNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.boundToPodId === podId
    );
  }

  deleteByBoundPodId(podId: string): number {
    const notesToDelete = this.findByBoundPodId(podId);

    for (const note of notesToDelete) {
      this.notes.delete(note.id);
    }

    if (notesToDelete.length > 0) {
      this.saveToDiskAsync();
    }

    return notesToDelete.length;
  }

  findByRepositoryId(repositoryId: string): RepositoryNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.repositoryId === repositoryId
    );
  }

  deleteByRepositoryId(repositoryId: string): string[] {
    const notesToDelete = this.findByRepositoryId(repositoryId);
    const deletedIds: string[] = [];

    for (const note of notesToDelete) {
      this.notes.delete(note.id);
      deletedIds.push(note.id);
    }

    if (deletedIds.length > 0) {
      this.saveToDiskAsync();
    }

    return deletedIds;
  }

  async loadFromDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    try {
      await fs.access(this.notesFilePath);
    } catch {
      console.log('[RepositoryNoteStore] No existing repository notes file found, starting fresh');
      this.notes.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.notesFilePath, 'utf-8');

    try {
      const notesArray: RepositoryNote[] = JSON.parse(data);

      this.notes.clear();
      for (const note of notesArray) {
        this.notes.set(note.id, note);
      }

      console.log(`[RepositoryNoteStore] Loaded ${this.notes.size} repository notes from disk`);
      return ok(undefined);
    } catch (error) {
      console.error(`[RepositoryNoteStore] Failed to load repository notes from disk: ${error}`);
      return err('載入儲存庫筆記失敗');
    }
  }

  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const notesArray = Array.from(this.notes.values());
    await fs.writeFile(this.notesFilePath, JSON.stringify(notesArray, null, 2), 'utf-8');

    return ok(undefined);
  }

  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      console.error(`[RepositoryNoteStore] Failed to persist repository notes: ${error}`);
    });
  }
}

export const repositoryNoteStore = new RepositoryNoteStore();
