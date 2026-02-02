import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { Trigger, TriggerType, TimeTriggerConfig, PersistedTrigger } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { canvasStore } from './canvasStore.js';

interface CreateTriggerData {
  name: string;
  type: TriggerType;
  config: TimeTriggerConfig;
  x: number;
  y: number;
  rotation: number;
  enabled: boolean;
}

class TriggerStore {
  private triggersByCanvas: Map<string, Map<string, Trigger>> = new Map();

  private getOrCreateCanvasMap(canvasId: string): Map<string, Trigger> {
    let triggersMap = this.triggersByCanvas.get(canvasId);
    if (!triggersMap) {
      triggersMap = new Map();
      this.triggersByCanvas.set(canvasId, triggersMap);
    }
    return triggersMap;
  }

  create(canvasId: string, data: CreateTriggerData): Trigger {
    const id = uuidv4();

    const trigger: Trigger = {
      id,
      name: data.name,
      type: data.type,
      config: data.config,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      enabled: data.enabled,
      lastTriggeredAt: null,
      createdAt: new Date(),
    };

    const triggersMap = this.getOrCreateCanvasMap(canvasId);
    triggersMap.set(id, trigger);
    this.saveToDiskAsync(canvasId);

    return trigger;
  }

  getById(canvasId: string, id: string): Trigger | undefined {
    const triggersMap = this.triggersByCanvas.get(canvasId);
    return triggersMap?.get(id);
  }

  list(canvasId: string): Trigger[] {
    const triggersMap = this.triggersByCanvas.get(canvasId);
    return triggersMap ? Array.from(triggersMap.values()) : [];
  }

  listAll(): Array<{ canvasId: string; trigger: Trigger }> {
    const result: Array<{ canvasId: string; trigger: Trigger }> = [];

    for (const [canvasId, triggersMap] of this.triggersByCanvas.entries()) {
      for (const trigger of triggersMap.values()) {
        result.push({ canvasId, trigger });
      }
    }

    return result;
  }

  update(canvasId: string, id: string, updates: Partial<Pick<Trigger, 'name' | 'type' | 'config' | 'x' | 'y' | 'rotation' | 'enabled'>>): Trigger | undefined {
    const triggersMap = this.triggersByCanvas.get(canvasId);
    if (!triggersMap) {
      return undefined;
    }

    const trigger = triggersMap.get(id);
    if (!trigger) {
      return undefined;
    }

    if (updates.name !== undefined) {
      trigger.name = updates.name;
    }
    if (updates.type !== undefined) {
      trigger.type = updates.type;
    }
    if (updates.config !== undefined) {
      trigger.config = updates.config;
    }
    if (updates.x !== undefined) {
      trigger.x = updates.x;
    }
    if (updates.y !== undefined) {
      trigger.y = updates.y;
    }
    if (updates.rotation !== undefined) {
      trigger.rotation = updates.rotation;
    }
    if (updates.enabled !== undefined) {
      trigger.enabled = updates.enabled;
    }

    triggersMap.set(id, trigger);
    this.saveToDiskAsync(canvasId);

    return trigger;
  }

  delete(canvasId: string, id: string): boolean {
    const triggersMap = this.triggersByCanvas.get(canvasId);
    if (!triggersMap) {
      return false;
    }

    const deleted = triggersMap.delete(id);
    if (deleted) {
      this.saveToDiskAsync(canvasId);
    }
    return deleted;
  }

  async loadFromDisk(canvasId: string, canvasDataDir: string): Promise<Result<void>> {
    const triggersFilePath = path.join(canvasDataDir, 'triggers.json');

    await fs.mkdir(canvasDataDir, { recursive: true });

    try {
      await fs.access(triggersFilePath);
    } catch {
      this.triggersByCanvas.set(canvasId, new Map());
      return ok(undefined);
    }

    const data = await fs.readFile(triggersFilePath, 'utf-8');

    try {
      const persistedTriggers: PersistedTrigger[] = JSON.parse(data);

      const triggersMap = new Map<string, Trigger>();
      for (const persisted of persistedTriggers) {
        const trigger: Trigger = {
          ...persisted,
          enabled: persisted.enabled ?? true,
          lastTriggeredAt: persisted.lastTriggeredAt ? new Date(persisted.lastTriggeredAt) : null,
          createdAt: new Date(persisted.createdAt),
        };
        triggersMap.set(trigger.id, trigger);
      }

      this.triggersByCanvas.set(canvasId, triggersMap);

      logger.log('Trigger', 'Load', `[TriggerStore] Loaded ${triggersMap.size} triggers for canvas ${canvasId}`);
      return ok(undefined);
    } catch (error) {
      logger.error('Trigger', 'Error', `[TriggerStore] Failed to load triggers for canvas ${canvasId}`, error);
      return err('載入觸發器資料失敗');
    }
  }

  async saveToDisk(canvasId: string): Promise<Result<void>> {
    const canvasDataDir = canvasStore.getCanvasDataDir(canvasId);
    if (!canvasDataDir) {
      return err('Canvas not found');
    }

    const triggersFilePath = path.join(canvasDataDir, 'triggers.json');

    await fs.mkdir(canvasDataDir, { recursive: true });

    const triggersMap = this.triggersByCanvas.get(canvasId);
    const triggersArray = triggersMap ? Array.from(triggersMap.values()) : [];
    const persistedTriggers: PersistedTrigger[] = triggersArray.map((trigger) => ({
      id: trigger.id,
      name: trigger.name,
      type: trigger.type,
      config: trigger.config,
      x: trigger.x,
      y: trigger.y,
      rotation: trigger.rotation,
      enabled: trigger.enabled,
      lastTriggeredAt: trigger.lastTriggeredAt ? trigger.lastTriggeredAt.toISOString() : null,
      createdAt: trigger.createdAt.toISOString(),
    }));

    await fs.writeFile(
      triggersFilePath,
      JSON.stringify(persistedTriggers, null, 2),
      'utf-8'
    );

    return ok(undefined);
  }

  setLastTriggeredAt(canvasId: string, id: string, date: Date): void {
    const triggersMap = this.triggersByCanvas.get(canvasId);
    if (!triggersMap) {
      return;
    }

    const trigger = triggersMap.get(id);
    if (!trigger) {
      return;
    }

    trigger.lastTriggeredAt = date;
    triggersMap.set(id, trigger);
    this.saveToDiskAsync(canvasId);
  }

  private saveToDiskAsync(canvasId: string): void {
    this.saveToDisk(canvasId).catch((error) => {
      logger.error('Trigger', 'Error', `[TriggerStore] Failed to persist triggers for canvas ${canvasId}`, error);
    });
  }

  async loadAllCanvases(canvasEntries: Array<{ id: string; dataDir: string }>): Promise<void> {
    for (const entry of canvasEntries) {
      await this.loadFromDisk(entry.id, entry.dataDir);
    }
  }

  clearCanvasData(canvasId: string): void {
    this.triggersByCanvas.delete(canvasId);
  }
}

export const triggerStore = new TriggerStore();
