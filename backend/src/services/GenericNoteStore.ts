import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface BaseNote {
  id: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface GenericNoteStoreConfig<T, K extends keyof T> {
  fileName: string;
  foreignKeyField: K;
  storeName: string;
}

export class GenericNoteStore<T extends BaseNote, K extends keyof T> {
  protected notes: Map<string, T> = new Map();
  protected readonly notesFilePath: string;
  protected readonly config: GenericNoteStoreConfig<T, K>;

  constructor(storeConfig: GenericNoteStoreConfig<T, K>) {
    this.config = storeConfig;
    this.notesFilePath = path.join(config.canvasRoot, 'data', storeConfig.fileName);
  }

  create(data: Omit<T, 'id'>): T {
    const id = uuidv4();

    const note = {
      id,
      ...data,
    } as T;

    this.notes.set(id, note);
    this.saveToDiskAsync();

    return note;
  }

  getById(id: string): T | undefined {
    return this.notes.get(id);
  }

  list(): T[] {
    return Array.from(this.notes.values());
  }

  update(id: string, updates: Partial<Omit<T, 'id'>>): T | undefined {
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

  findByBoundPodId(podId: string): T[] {
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

  findByForeignKey(foreignKeyValue: string): T[] {
    return Array.from(this.notes.values()).filter(
      (note) => note[this.config.foreignKeyField] === foreignKeyValue
    );
  }

  deleteByForeignKey(foreignKeyValue: string): string[] {
    const notesToDelete = this.findByForeignKey(foreignKeyValue);
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
      this.notes.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.notesFilePath, 'utf-8');

    try {
      const notesArray: T[] = JSON.parse(data);

      this.notes.clear();
      for (const note of notesArray) {
        this.notes.set(note.id, note);
      }

      logger.log('Note', 'Load', `[${this.config.storeName}] Loaded ${this.notes.size} notes`);
      return ok(undefined);
    } catch (error) {
      logger.error('Note', 'Error', `[${this.config.storeName}] Failed to load notes`, error);
      return err('載入筆記失敗');
    }
  }

  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const notesArray = Array.from(this.notes.values());
    await fs.writeFile(this.notesFilePath, JSON.stringify(notesArray, null, 2), 'utf-8');

    return ok(undefined);
  }

  saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      logger.error('Note', 'Error', `[${this.config.storeName}] Failed to persist notes`, error);
    });
  }
}

export function createNoteStore<T extends BaseNote, K extends keyof T>(
  config: GenericNoteStoreConfig<T, K>
): GenericNoteStore<T, K> {
  return new GenericNoteStore(config);
}
