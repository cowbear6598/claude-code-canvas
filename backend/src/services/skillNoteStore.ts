// Skill Note Store
// Manages Skill Notes with persistence to disk

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { SkillNote } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';

interface CreateSkillNoteData {
  skillId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

class SkillNoteStore {
  private notes: Map<string, SkillNote> = new Map();
  private readonly notesFilePath: string;

  constructor() {
    this.notesFilePath = path.join(config.canvasRoot, 'data', 'skill-notes.json');
  }

  /**
   * Create a new skill note
   */
  create(data: CreateSkillNoteData): SkillNote {
    const id = uuidv4();

    const note: SkillNote = {
      id,
      skillId: data.skillId,
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
   * Get a skill note by ID
   */
  getById(id: string): SkillNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Get all skill notes
   */
  list(): SkillNote[] {
    return Array.from(this.notes.values());
  }

  /**
   * Update a skill note
   */
  update(id: string, updates: Partial<Omit<SkillNote, 'id'>>): SkillNote | undefined {
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
   * Delete a skill note
   */
  delete(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  /**
   * Find skill notes bound to a specific Pod
   */
  findByBoundPodId(podId: string): SkillNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.boundToPodId === podId
    );
  }

  /**
   * Delete all skill notes bound to a specific Pod
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
   * Load skill notes from disk
   */
  async loadFromDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    // 檢查檔案是否存在
    try {
      await fs.access(this.notesFilePath);
    } catch {
      console.log('[SkillNoteStore] No existing skill notes file found, starting fresh');
      this.notes.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.notesFilePath, 'utf-8');

    // JSON.parse 可能拋錯，保留 try-catch
    try {
      const notesArray: SkillNote[] = JSON.parse(data);

      this.notes.clear();
      for (const note of notesArray) {
        this.notes.set(note.id, note);
      }

      console.log(`[SkillNoteStore] Loaded ${this.notes.size} skill notes from disk`);
      return ok(undefined);
    } catch (error) {
      console.error(`[SkillNoteStore] Failed to load skill notes from disk: ${error}`);
      return err('載入技能筆記失敗');
    }
  }

  /**
   * Save skill notes to disk
   */
  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.notesFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const notesArray = Array.from(this.notes.values());
    await fs.writeFile(this.notesFilePath, JSON.stringify(notesArray, null, 2), 'utf-8');

    return ok(undefined);
  }

  /**
   * Save skill notes to disk asynchronously (non-blocking)
   */
  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      console.error(`[SkillNoteStore] Failed to persist skill notes: ${error}`);
    });
  }
}

// Export singleton instance
export const skillNoteStore = new SkillNoteStore();
