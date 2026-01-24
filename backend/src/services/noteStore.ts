// Output Style Note Store
// Manages Output Style Notes with persistence to disk

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { OutputStyleNote } from '../types/outputStyleNote.js';
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
    this.notesFilePath = path.join(config.workspaceRoot, 'data', 'notes.json');
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
   * Load notes from disk
   */
  async loadFromDisk(): Promise<void> {
    try {
      // Ensure the data directory exists
      const dataDir = path.dirname(this.notesFilePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Try to read the notes file
      try {
        const data = await fs.readFile(this.notesFilePath, 'utf-8');
        const notesArray: OutputStyleNote[] = JSON.parse(data);

        // Load notes into the Map
        this.notes.clear();
        for (const note of notesArray) {
          this.notes.set(note.id, note);
        }

        console.log(`[NoteStore] Loaded ${this.notes.size} notes from disk`);
      } catch (readError: unknown) {
        // If the file doesn't exist, that's okay - start with empty notes
        const error = readError as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
          console.log('[NoteStore] No existing notes file found, starting fresh');
          this.notes.clear();
        } else {
          throw readError;
        }
      }
    } catch (error) {
      console.error(`[NoteStore] Failed to load notes from disk: ${error}`);
      throw error;
    }
  }

  /**
   * Save notes to disk
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
      console.error(`[NoteStore] Failed to save notes to disk: ${error}`);
      throw error;
    }
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
