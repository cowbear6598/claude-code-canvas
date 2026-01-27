// Repository Note Store
// Manages Repository Notes with persistence to disk

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { RepositoryNote } from '../types/repositoryNote.js';
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

  /**
   * Create a new repository note
   */
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

  /**
   * Get a repository note by ID
   */
  getById(id: string): RepositoryNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Get all repository notes
   */
  list(): RepositoryNote[] {
    return Array.from(this.notes.values());
  }

  /**
   * Update a repository note
   */
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

  /**
   * Delete a repository note
   */
  delete(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  /**
   * Find repository notes bound to a specific Pod
   */
  findByBoundPodId(podId: string): RepositoryNote[] {
    return Array.from(this.notes.values()).filter(
      (note) => note.boundToPodId === podId
    );
  }

  /**
   * Delete all repository notes bound to a specific Pod
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
   * Load repository notes from disk
   */
  async loadFromDisk(): Promise<void> {
    try {
      // Ensure the data directory exists
      const dataDir = path.dirname(this.notesFilePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Try to read the repository notes file
      try {
        const data = await fs.readFile(this.notesFilePath, 'utf-8');
        const notesArray: RepositoryNote[] = JSON.parse(data);

        // Load repository notes into the Map
        this.notes.clear();
        for (const note of notesArray) {
          this.notes.set(note.id, note);
        }

        console.log(`[RepositoryNoteStore] Loaded ${this.notes.size} repository notes from disk`);
      } catch (readError: unknown) {
        // If the file doesn't exist, that's okay - start with empty repository notes
        const error = readError as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
          console.log('[RepositoryNoteStore] No existing repository notes file found, starting fresh');
          this.notes.clear();
        } else {
          throw readError;
        }
      }
    } catch (error) {
      console.error(`[RepositoryNoteStore] Failed to load repository notes from disk: ${error}`);
      throw error;
    }
  }

  /**
   * Save repository notes to disk
   */
  async saveToDisk(): Promise<void> {
    try {
      // Ensure the data directory exists
      const dataDir = path.dirname(this.notesFilePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Convert Map to array
      const notesArray = Array.from(this.notes.values());

      // Write to file
      await fs.writeFile(this.notesFilePath, JSON.stringify(notesArray, null, 2), 'utf-8');
    } catch (error) {
      console.error(`[RepositoryNoteStore] Failed to save repository notes to disk: ${error}`);
      throw error;
    }
  }

  /**
   * Save repository notes to disk asynchronously (non-blocking)
   */
  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      console.error(`[RepositoryNoteStore] Failed to persist repository notes: ${error}`);
    });
  }
}

// Export singleton instance
export const repositoryNoteStore = new RepositoryNoteStore();
