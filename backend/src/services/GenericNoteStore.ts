import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { Result, ok, err } from '../types';
import { logger } from '../utils/logger.js';
import { canvasStore } from './canvasStore.js';
import { WriteQueue } from '../utils/writeQueue.js';
import { persistenceService } from './persistence/index.js';
import { readJsonFileOrDefault } from './shared/fileResourceHelpers.js';

export interface BaseNote {
  id: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

interface GenericNoteStoreConfig<T, K extends keyof T> {
  fileName: string;
  foreignKeyField: K;
  storeName: string;
}

export class GenericNoteStore<T extends BaseNote, K extends keyof T> {
  protected notesByCanvas: Map<string, Map<string, T>> = new Map();
  protected readonly config: GenericNoteStoreConfig<T, K>;
  private writeQueue!: WriteQueue;

  constructor(storeConfig: GenericNoteStoreConfig<T, K>) {
    this.config = storeConfig;
    this.writeQueue = new WriteQueue('Note', this.config.storeName);
  }

  private getOrCreateCanvasMap(canvasId: string): Map<string, T> {
    let notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      notesMap = new Map();
      this.notesByCanvas.set(canvasId, notesMap);
    }
    return notesMap;
  }

  create(canvasId: string, data: Omit<T, 'id'>): T {
    const id = uuidv4();

    const note = {
      id,
      ...data,
    } as T;

    const notesMap = this.getOrCreateCanvasMap(canvasId);
    notesMap.set(id, note);
    this.saveToDiskAsync(canvasId);

    return note;
  }

  getById(canvasId: string, id: string): T | undefined {
    const notesMap = this.notesByCanvas.get(canvasId);
    return notesMap?.get(id);
  }

  list(canvasId: string): T[] {
    const notesMap = this.notesByCanvas.get(canvasId);
    return notesMap ? Array.from(notesMap.values()) : [];
  }

  update(canvasId: string, id: string, updates: Partial<Omit<T, 'id'>>): T | undefined {
    const notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      return undefined;
    }

    const note = notesMap.get(id);
    if (!note) {
      return undefined;
    }

    const updatedNote = { ...note, ...updates };
    notesMap.set(id, updatedNote);
    this.saveToDiskAsync(canvasId);

    return updatedNote;
  }

  delete(canvasId: string, id: string): boolean {
    const notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      return false;
    }

    const deleted = notesMap.delete(id);
    if (deleted) {
      this.saveToDiskAsync(canvasId);
    }
    return deleted;
  }

  findByBoundPodId(canvasId: string, podId: string): T[] {
    const notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      return [];
    }

    return Array.from(notesMap.values()).filter(
      (note) => note.boundToPodId === podId
    );
  }

  deleteByBoundPodId(canvasId: string, podId: string): string[] {
    return this.deleteByPredicate(canvasId, (note) => note.boundToPodId === podId);
  }

  findByForeignKey(canvasId: string, foreignKeyValue: string): T[] {
    const notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      return [];
    }

    return Array.from(notesMap.values()).filter(
      (note) => note[this.config.foreignKeyField] === foreignKeyValue
    );
  }

  deleteByForeignKey(canvasId: string, foreignKeyValue: string): string[] {
    return this.deleteByPredicate(canvasId, (note) => note[this.config.foreignKeyField] === foreignKeyValue);
  }

  private deleteByPredicate(canvasId: string, predicate: (note: T) => boolean): string[] {
    const notesMap = this.notesByCanvas.get(canvasId);
    if (!notesMap) {
      return [];
    }

    const deletedIds: string[] = [];
    for (const note of notesMap.values()) {
      if (!predicate(note)) continue;
      notesMap.delete(note.id);
      deletedIds.push(note.id);
    }

    if (deletedIds.length > 0) {
      this.saveToDiskAsync(canvasId);
    }

    return deletedIds;
  }

  async loadFromDisk(canvasId: string, canvasDataDir: string): Promise<Result<void>> {
    const notesFilePath = path.join(canvasDataDir, this.config.fileName);

    await fs.mkdir(canvasDataDir, { recursive: true });

    const notesArray = await readJsonFileOrDefault<T>(notesFilePath);
    if (notesArray === null) {
      this.notesByCanvas.set(canvasId, new Map());
      return ok(undefined);
    }

    const notesMap = new Map<string, T>();
    for (const note of notesArray) {
      notesMap.set(note.id, note);
    }

    this.notesByCanvas.set(canvasId, notesMap);

    logger.log('Note', 'Load', `[${this.config.storeName}] Loaded ${notesMap.size} notes for canvas ${canvasId}`);
    return ok(undefined);
  }

  async saveToDisk(canvasId: string): Promise<Result<void>> {
    const canvasDataDir = canvasStore.getCanvasDataDir(canvasId);
    if (!canvasDataDir) {
      return err('Canvas not found');
    }

    const notesFilePath = path.join(canvasDataDir, this.config.fileName);

    const notesMap = this.notesByCanvas.get(canvasId);
    const notesArray = notesMap ? Array.from(notesMap.values()) : [];
    return persistenceService.writeJson(notesFilePath, notesArray);
  }

  saveToDiskAsync(canvasId: string): void {
    this.writeQueue.enqueue(canvasId, () => this.saveToDisk(canvasId).then(() => undefined));
  }

  /** 等待指定 Canvas 所有排隊中的磁碟寫入完成 */
  flushWrites(canvasId: string): Promise<void> {
    return this.writeQueue.flush(canvasId);
  }
}

export function createNoteStore<T extends BaseNote, K extends keyof T>(
  config: GenericNoteStoreConfig<T, K>
): GenericNoteStore<T, K> {
  return new GenericNoteStore(config);
}
