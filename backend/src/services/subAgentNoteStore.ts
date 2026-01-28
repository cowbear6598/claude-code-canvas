import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { SubAgentNote } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';

interface CreateSubAgentNoteData {
  subAgentId: string;
  name: string;
  x: number;
  y: number;
  boundToPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

class SubAgentNoteStore {
  private notes: Map<string, SubAgentNote> = new Map();
  private readonly notesFilePath: string;

  constructor() {
    this.notesFilePath = path.join(config.canvasRoot, 'data', 'subagent-notes.json');
  }

  create(data: CreateSubAgentNoteData): SubAgentNote {
    const id = uuidv4();

    const note: SubAgentNote = {
      id,
      subAgentId: data.subAgentId,
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

  getById(id: string): SubAgentNote | undefined {
    return this.notes.get(id);
  }

  list(): SubAgentNote[] {
    return Array.from(this.notes.values());
  }

  update(id: string, updates: Partial<Omit<SubAgentNote, 'id'>>): SubAgentNote | undefined {
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

  findByBoundPodId(podId: string): SubAgentNote[] {
    return Array.from(this.notes.values()).filter((note) => note.boundToPodId === podId);
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

  findBySubAgentId(subAgentId: string): SubAgentNote[] {
    return Array.from(this.notes.values()).filter((note) => note.subAgentId === subAgentId);
  }

  deleteBySubAgentId(subAgentId: string): string[] {
    const notesToDelete = this.findBySubAgentId(subAgentId);
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
      console.log('[SubAgentNoteStore] No existing subagent notes file found, starting fresh');
      this.notes.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.notesFilePath, 'utf-8');

    try {
      const notesArray: SubAgentNote[] = JSON.parse(data);

      this.notes.clear();
      for (const note of notesArray) {
        this.notes.set(note.id, note);
      }

      console.log(`[SubAgentNoteStore] Loaded ${this.notes.size} subagent notes from disk`);
      return ok(undefined);
    } catch (error) {
      console.error(`[SubAgentNoteStore] Failed to load subagent notes from disk: ${error}`);
      return err('載入子代理筆記失敗');
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
      console.error(`[SubAgentNoteStore] Failed to persist subagent notes: ${error}`);
    });
  }
}

export const subAgentNoteStore = new SubAgentNoteStore();
