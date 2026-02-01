import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { Trigger, TriggerType, TimeTriggerConfig, PersistedTrigger } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

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
  private triggers: Map<string, Trigger> = new Map();
  private readonly triggersFilePath: string;

  constructor() {
    this.triggersFilePath = path.join(config.canvasRoot, 'data', 'triggers.json');
  }

  create(data: CreateTriggerData): Trigger {
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

    this.triggers.set(id, trigger);
    this.saveToDiskAsync();

    return trigger;
  }

  getById(id: string): Trigger | undefined {
    return this.triggers.get(id);
  }

  list(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  update(id: string, updates: Partial<Pick<Trigger, 'name' | 'type' | 'config' | 'x' | 'y' | 'rotation' | 'enabled'>>): Trigger | undefined {
    const trigger = this.triggers.get(id);
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

    this.triggers.set(id, trigger);
    this.saveToDiskAsync();

    return trigger;
  }

  delete(id: string): boolean {
    const deleted = this.triggers.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  async loadFromDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.triggersFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    try {
      await fs.access(this.triggersFilePath);
    } catch {
      this.triggers.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.triggersFilePath, 'utf-8');

    try {
      const persistedTriggers: PersistedTrigger[] = JSON.parse(data);

      this.triggers.clear();
      for (const persisted of persistedTriggers) {
        const trigger: Trigger = {
          ...persisted,
          enabled: persisted.enabled ?? true,
          lastTriggeredAt: persisted.lastTriggeredAt ? new Date(persisted.lastTriggeredAt) : null,
          createdAt: new Date(persisted.createdAt),
        };
        this.triggers.set(trigger.id, trigger);
      }

      logger.log('Trigger', 'Load', `[TriggerStore] Loaded ${this.triggers.size} triggers`);
      return ok(undefined);
    } catch (error) {
      logger.error('Trigger', 'Error', `[TriggerStore] Failed to load triggers`, error);
      return err('載入觸發器資料失敗');
    }
  }

  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.triggersFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const triggersArray = Array.from(this.triggers.values());
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
      this.triggersFilePath,
      JSON.stringify(persistedTriggers, null, 2),
      'utf-8'
    );

    return ok(undefined);
  }

  setLastTriggeredAt(id: string, date: Date): void {
    const trigger = this.triggers.get(id);
    if (!trigger) {
      return;
    }

    trigger.lastTriggeredAt = date;
    this.triggers.set(id, trigger);
    this.saveToDiskAsync();
  }

  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      logger.error('Trigger', 'Error', `[TriggerStore] Failed to persist triggers`, error);
    });
  }
}

export const triggerStore = new TriggerStore();
