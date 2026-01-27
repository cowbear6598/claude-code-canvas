// Output Style Note Store
// Manages Output Style Notes with persistence to disk

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { OutputStyleNote } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';

interface CreateNoteData {
  outputStyleId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

class NoteStore {
  private notes: Map<string, OutputStyleNote> = new Map();
  private readonly notesFilePath: string;

  constructor() {
    this.notesFilePath = path.join(config.canvasRoot, 'data', 'notes.json');
  }

  /**
   * Create a new note
   */
  create(data: CreateNoteData): OutputStyleNote {
    const id = uuidv4();

    const note: OutputStyleNote = {
      id,
      outputStyleId: data.outputStyleId,
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

  /**
   * Get a note by ID
   */
  getById(id: string): OutputStyleNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Get all notes
   */
  list(): OutputStyleNote[] {
    return Array.from(this.notes.values());
  }

  /**
   * Update a note
   */
  update(id: string, updates: Partial<Omit<OutputStyleNote, 'id'>>): OutputStyleNote | undefined {
    const note = this.notes.get(id);
    if (!note) {
      return undefined;
    }

    const updatedNote = { ...note, ...updates };
    this.notes.set(id, updatedNote);
    this.saveToDiskAsync();

    return updatedNote;
  }

  /**
   * Delete a note
   */
  delete(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  /**
   * Find notes bound to a specific Pod
   */
  findByBoundPodId(podId: string): OutputStyleNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.boundToPodId === podId
    );
  }

  /**
   * Delete all notes bound to a specific Pod
   */
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

  /**
   * Find notes by output style ID
   */
  findByOutputStyleId(outputStyleId: string): OutputStyleNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.outputStyleId === outputStyleId
    );
  }

  /**
   * Delete all notes for a specific output style ID
   */
  deleteByOutputStyleId(outputStyleId: string): string[] {
    const notesToDelete = this.findByOutputStyleId(outputStyleId);
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

  /**
   * Load notes from disk
   */
  async loadFromDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    // 檢查檔案是否存在
    try {
      await fs.access(this.notesFilePath);
    } catch {
      console.log('[NoteStore] No existing notes file found, starting fresh');
      this.notes.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.notesFilePath, 'utf-8');

    // JSON.parse 可能拋錯，保留 try-catch
    try {
      const notesArray: OutputStyleNote[] = JSON.parse(data);

      this.notes.clear();
      for (const note of notesArray) {
        this.notes.set(note.id, note);
      }

      console.log(`[NoteStore] Loaded ${this.notes.size} notes from disk`);
      return ok(undefined);
    } catch (error) {
      console.error(`[NoteStore] Failed to load notes from disk: ${error}`);
      return err('載入輸出風格筆記失敗');
    }
  }

  /**
   * Save notes to disk
   */
  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const notesArray = Array.from(this.notes.values());
    await fs.writeFile(this.notesFilePath, JSON.stringify(notesArray, null, 2), 'utf-8');

    return ok(undefined);
  }

  /**
   * Save notes to disk asynchronously (non-blocking)
   */
  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      console.error(`[NoteStore] Failed to persist notes: ${error}`);
    });
  }
}

// Export singleton instance
export const noteStore = new NoteStore();
