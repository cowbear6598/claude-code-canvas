import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { Canvas, PersistedCanvas } from '../types/canvas.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class CanvasStore {
  private canvases: Map<string, Canvas> = new Map();
  private activeCanvasMap: Map<string, string> = new Map();

  private validateCanvasName(name: string): Result<void> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return err('Canvas name cannot be empty');
    }

    if (trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName.includes('..')) {
      return err('Canvas name contains invalid characters');
    }

    const existingCanvas = Array.from(this.canvases.values()).find(
      (canvas) => canvas.name === trimmedName
    );

    if (existingCanvas) {
      return err('Canvas with this name already exists');
    }

    return ok(undefined);
  }

  async create(name: string): Promise<Result<Canvas>> {
    const validationResult = this.validateCanvasName(name);
    if (!validationResult.success) {
      return err(validationResult.error!);
    }

    const id = uuidv4();
    const trimmedName = name.trim();
    const createdAt = new Date();

    const canvas: Canvas = {
      id,
      name: trimmedName,
      createdAt,
    };

    const canvasPath = config.getCanvasPath(trimmedName);
    const canvasDataPath = config.getCanvasDataPath(trimmedName);
    const canvasJsonPath = path.join(canvasPath, 'canvas.json');

    try {
      await fs.mkdir(canvasPath, { recursive: true });
      await fs.mkdir(canvasDataPath, { recursive: true });

      const persistedCanvas: PersistedCanvas = {
        id,
        name: trimmedName,
        createdAt: createdAt.toISOString(),
      };

      await fs.writeFile(canvasJsonPath, JSON.stringify(persistedCanvas, null, 2), 'utf-8');

      this.canvases.set(id, canvas);

      logger.log('Canvas', 'Create', `Created canvas: ${trimmedName} (${id})`);

      return ok(canvas);
    } catch (error) {
      logger.error('Canvas', 'Error', `Failed to create canvas: ${trimmedName}`, error);
      return err('Failed to create canvas');
    }
  }

  list(): Canvas[] {
    return Array.from(this.canvases.values());
  }

  getById(id: string): Canvas | undefined {
    return this.canvases.get(id);
  }

  getByName(name: string): Canvas | undefined {
    return Array.from(this.canvases.values()).find((canvas) => canvas.name === name);
  }

  async rename(id: string, newName: string): Promise<Result<Canvas>> {
    const canvas = this.canvases.get(id);
    if (!canvas) {
      return err('Canvas not found');
    }

    const trimmedName = newName.trim();

    if (!trimmedName) {
      return err('Canvas name cannot be empty');
    }

    if (trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName.includes('..')) {
      return err('Canvas name contains invalid characters');
    }

    const existingCanvas = Array.from(this.canvases.values()).find(
      (c) => c.name === trimmedName && c.id !== id
    );

    if (existingCanvas) {
      return err('Canvas with this name already exists');
    }

    const oldPath = config.getCanvasPath(canvas.name);
    const newPath = config.getCanvasPath(trimmedName);

    try {
      await fs.rename(oldPath, newPath);

      const canvasJsonPath = path.join(newPath, 'canvas.json');
      const persistedCanvas: PersistedCanvas = {
        id: canvas.id,
        name: trimmedName,
        createdAt: canvas.createdAt.toISOString(),
      };

      await fs.writeFile(canvasJsonPath, JSON.stringify(persistedCanvas, null, 2), 'utf-8');

      canvas.name = trimmedName;
      this.canvases.set(id, canvas);

      logger.log('Canvas', 'Rename', `Renamed canvas from ${oldPath} to ${newPath}`);

      return ok(canvas);
    } catch (error) {
      logger.error('Canvas', 'Error', `Failed to rename canvas: ${id}`, error);
      return err('Failed to rename canvas');
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    const canvas = this.canvases.get(id);
    if (!canvas) {
      return err('Canvas not found');
    }

    const canvasPath = config.getCanvasPath(canvas.name);

    try {
      await fs.rm(canvasPath, { recursive: true, force: true });
      this.canvases.delete(id);

      logger.log('Canvas', 'Delete', `Deleted canvas: ${canvas.name} (${id})`);

      return ok(true);
    } catch (error) {
      logger.error('Canvas', 'Error', `Failed to delete canvas: ${id}`, error);
      return err('Failed to delete canvas');
    }
  }

  async loadFromDisk(): Promise<Result<void>> {
    try {
      await fs.mkdir(config.canvasRoot, { recursive: true });

      const entries = await fs.readdir(config.canvasRoot, { withFileTypes: true });
      const directories = entries.filter((entry) => entry.isDirectory());

      this.canvases.clear();

      for (const dir of directories) {
        const canvasJsonPath = path.join(config.canvasRoot, dir.name, 'canvas.json');

        try {
          await fs.access(canvasJsonPath);
          const data = await fs.readFile(canvasJsonPath, 'utf-8');
          const persistedCanvas: PersistedCanvas = JSON.parse(data);

          const canvas: Canvas = {
            id: persistedCanvas.id,
            name: persistedCanvas.name,
            createdAt: new Date(persistedCanvas.createdAt),
          };

          this.canvases.set(canvas.id, canvas);
        } catch (error) {
          logger.error('Canvas', 'Load', `Failed to load canvas from ${dir.name}`, error);
        }
      }

      logger.log('Canvas', 'Load', `Loaded ${this.canvases.size} canvases`);
      return ok(undefined);
    } catch (error) {
      logger.error('Canvas', 'Error', 'Failed to load canvases from disk', error);
      return err('Failed to load canvases');
    }
  }

  getCanvasDir(canvasId: string): string | undefined {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) {
      return undefined;
    }
    return config.getCanvasPath(canvas.name);
  }

  getCanvasDataDir(canvasId: string): string | undefined {
    const canvas = this.canvases.get(canvasId);
    if (!canvas) {
      return undefined;
    }
    return config.getCanvasDataPath(canvas.name);
  }

  setActiveCanvas(socketId: string, canvasId: string): void {
    this.activeCanvasMap.set(socketId, canvasId);
  }

  getActiveCanvas(socketId: string): string | undefined {
    return this.activeCanvasMap.get(socketId);
  }

  removeSocket(socketId: string): void {
    this.activeCanvasMap.delete(socketId);
  }

  clearCanvasData(canvasId: string): void {
    this.canvases.delete(canvasId);
  }
}

export const canvasStore = new CanvasStore();
