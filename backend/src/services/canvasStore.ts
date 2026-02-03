import {v4 as uuidv4} from 'uuid';
import {promises as fs} from 'fs';
import path from 'path';
import type {Canvas, PersistedCanvas} from '../types/canvas.js';
import {Result, ok, err} from '../types/index.js';
import {config} from '../config/index.js';
import {logger} from '../utils/logger.js';

class CanvasStore {
    private canvases: Map<string, Canvas> = new Map();
    private activeCanvasMap: Map<string, string> = new Map();

    private static readonly WINDOWS_RESERVED_NAMES = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    private validateCanvasName(name: string): Result<void> {
        const trimmedName = name.trim();

        if (!trimmedName) {
            return err('Canvas 名稱不能為空');
        }

        if (trimmedName.length > 50) {
            return err('Canvas 名稱不能超過 50 個字元');
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(trimmedName)) {
            return err('Canvas 名稱只能包含英文字母、數字、底線、連字號和空格');
        }

        const upperName = trimmedName.toUpperCase();
        if (CanvasStore.WINDOWS_RESERVED_NAMES.includes(upperName)) {
            return err('Canvas 名稱為系統保留名稱');
        }

        const existingCanvas = Array.from(this.canvases.values()).find(
            (canvas) => canvas.name === trimmedName
        );

        if (existingCanvas) {
            return err('已存在相同名稱的 Canvas');
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
            await fs.mkdir(canvasPath, {recursive: true});
            await fs.mkdir(canvasDataPath, {recursive: true});

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
            return err('建立 Canvas 失敗');
        }
    }

    list(): Canvas[] {
        return Array.from(this.canvases.values());
    }

    getById(id: string): Canvas | undefined {
        return this.canvases.get(id);
    }

    async rename(id: string, newName: string): Promise<Result<Canvas>> {
        const canvas = this.canvases.get(id);
        if (!canvas) {
            return err('找不到 Canvas');
        }

        const trimmedName = newName.trim();

        const validationResult = this.validateCanvasName(trimmedName);
        if (!validationResult.success) {
            return err(validationResult.error!);
        }

        const oldPath = config.getCanvasPath(canvas.name);
        const newPath = config.getCanvasPath(trimmedName);

        try {
            try {
                await fs.mkdir(newPath, {recursive: false});
                await fs.rmdir(newPath);
            } catch {
                return err('目標路徑已存在');
            }

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
            return err('重新命名 Canvas 失敗');
        }
    }

    async delete(id: string): Promise<Result<boolean>> {
        const canvas = this.canvases.get(id);
        if (!canvas) {
            return err('找不到 Canvas');
        }

        const canvasPath = config.getCanvasPath(canvas.name);

        const resolvedPath = path.resolve(canvasPath);
        const resolvedRoot = path.resolve(config.canvasRoot);

        if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
            logger.error('Canvas', 'Error', `Attempted path traversal: ${canvasPath}`);
            return err('無效的 Canvas 路徑');
        }

        try {
            await fs.rm(canvasPath, {recursive: true, force: true});
            this.canvases.delete(id);

            logger.log('Canvas', 'Delete', `Deleted canvas: ${canvas.name} (${id})`);

            return ok(true);
        } catch (error) {
            logger.error('Canvas', 'Error', `Failed to delete canvas: ${id}`, error);
            return err('刪除 Canvas 失敗');
        }
    }

    async loadFromDisk(): Promise<Result<void>> {
        try {
            await fs.mkdir(config.canvasRoot, {recursive: true});

            const entries = await fs.readdir(config.canvasRoot, {withFileTypes: true});
            const directories = entries.filter((entry) => entry.isDirectory());

            this.canvases.clear();

            for (const dir of directories) {
                const canvasJsonPath = path.join(config.canvasRoot, dir.name, 'canvas.json');

                try {
                    await fs.access(canvasJsonPath);
                } catch {
                    continue;
                }

                try {
                    const data = await fs.readFile(canvasJsonPath, 'utf-8');
                    const persistedCanvas: PersistedCanvas = JSON.parse(data);

                    const canvas: Canvas = {
                        id: persistedCanvas.id,
                        name: persistedCanvas.name,
                        createdAt: new Date(persistedCanvas.createdAt),
                    };

                    this.canvases.set(canvas.id, canvas);
                } catch (error) {
                    logger.error('Canvas', 'Load', `Failed to parse canvas.json in ${dir.name}`, error);
                }
            }

            logger.log('Canvas', 'Load', `Loaded ${this.canvases.size} canvases`);
            return ok(undefined);
        } catch (error) {
            logger.error('Canvas', 'Error', 'Failed to load canvases from disk', error);
            return err('載入 Canvas 列表失敗');
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
