import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { Connection, AnchorPosition } from '../types/index.js';
import type { PersistedConnection } from '../types/index.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface CreateConnectionData {
  sourceType?: 'pod' | 'trigger';
  sourcePodId: string;
  sourceTriggerId?: string | null;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  autoTrigger?: boolean;
}

class ConnectionStore {
  private connections: Map<string, Connection> = new Map();
  private readonly connectionsFilePath: string;

  constructor() {
    this.connectionsFilePath = path.join(config.canvasRoot, 'data', 'connections.json');
  }

  /**
   * Create a new connection
   */
  create(data: CreateConnectionData): Connection {
    const id = uuidv4();

    const connection: Connection = {
      id,
      sourceType: data.sourceType ?? 'pod',
      sourcePodId: data.sourcePodId,
      sourceTriggerId: data.sourceTriggerId ?? null,
      sourceAnchor: data.sourceAnchor,
      targetPodId: data.targetPodId,
      targetAnchor: data.targetAnchor,
      autoTrigger: data.autoTrigger ?? true,
      createdAt: new Date(),
    };

    this.connections.set(id, connection);
    this.saveToDiskAsync();

    return connection;
  }

  /**
   * Get a connection by ID
   */
  getById(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all connections
   */
  list(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Delete a connection
   */
  delete(id: string): boolean {
    const deleted = this.connections.delete(id);
    if (deleted) {
      this.saveToDiskAsync();
    }
    return deleted;
  }

  /**
   * Find connections by Pod ID (either source or target)
   */
  findByPodId(podId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.sourcePodId === podId || connection.targetPodId === podId
    );
  }

  /**
   * Find outgoing connections from a source Pod
   */
  findBySourcePodId(sourcePodId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.sourcePodId === sourcePodId
    );
  }

  /**
   * Find incoming connections to a target Pod
   */
  findByTargetPodId(targetPodId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.targetPodId === targetPodId
    );
  }

  /**
   * Update a connection
   */
  update(id: string, updates: Partial<{ autoTrigger: boolean }>): Connection | undefined {
    const connection = this.connections.get(id);
    if (!connection) {
      return undefined;
    }

    if (updates.autoTrigger !== undefined) {
      connection.autoTrigger = updates.autoTrigger;
    }

    this.connections.set(id, connection);
    this.saveToDiskAsync();

    return connection;
  }

  /**
   * Delete all connections related to a specific Pod
   */
  deleteByPodId(podId: string): number {
    const connectionsToDelete = this.findByPodId(podId);

    for (const connection of connectionsToDelete) {
      this.connections.delete(connection.id);
    }

    if (connectionsToDelete.length > 0) {
      this.saveToDiskAsync();
    }

    return connectionsToDelete.length;
  }

  /**
   * Find connections by Trigger ID (source)
   */
  findByTriggerId(triggerId: string): Connection[] {
    return Array.from(this.connections.values()).filter(
      (connection) => connection.sourceTriggerId === triggerId
    );
  }

  /**
   * Delete all connections related to a specific Trigger
   */
  deleteByTriggerId(triggerId: string): string[] {
    const connectionsToDelete = this.findByTriggerId(triggerId);
    const deletedIds: string[] = [];

    for (const connection of connectionsToDelete) {
      this.connections.delete(connection.id);
      deletedIds.push(connection.id);
    }

    if (deletedIds.length > 0) {
      this.saveToDiskAsync();
    }

    return deletedIds;
  }

  /**
   * Load connections from disk
   */
  async loadFromDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.connectionsFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    // 先檢查檔案是否存在
    try {
      await fs.access(this.connectionsFilePath);
    } catch {
      this.connections.clear();
      return ok(undefined);
    }

    const data = await fs.readFile(this.connectionsFilePath, 'utf-8');

    // JSON.parse 可能拋錯，保留 try-catch
    try {
      const persistedConnections: PersistedConnection[] = JSON.parse(data);

      this.connections.clear();
      for (const persisted of persistedConnections) {
        const connection: Connection = {
          ...persisted,
          sourceType: persisted.sourceType ?? 'pod',
          sourceTriggerId: persisted.sourceTriggerId ?? null,
          autoTrigger: persisted.autoTrigger ?? false,
          createdAt: new Date(persisted.createdAt),
        };
        this.connections.set(connection.id, connection);
      }

      logger.log('Connection', 'Load', `[ConnectionStore] Loaded ${this.connections.size} connections`);
      return ok(undefined);
    } catch (error) {
      logger.error('Connection', 'Error', `[ConnectionStore] Failed to load connections`, error);
      return err('載入連線資料失敗');
    }
  }

  /**
   * Save connections to disk
   */
  async saveToDisk(): Promise<Result<void>> {
    const dataDir = path.dirname(this.connectionsFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const connectionsArray = Array.from(this.connections.values());
    const persistedConnections: PersistedConnection[] = connectionsArray.map((connection) => ({
      id: connection.id,
      sourceType: connection.sourceType,
      sourcePodId: connection.sourcePodId,
      sourceTriggerId: connection.sourceTriggerId,
      sourceAnchor: connection.sourceAnchor,
      targetPodId: connection.targetPodId,
      targetAnchor: connection.targetAnchor,
      autoTrigger: connection.autoTrigger,
      createdAt: connection.createdAt.toISOString(),
    }));

    await fs.writeFile(
      this.connectionsFilePath,
      JSON.stringify(persistedConnections, null, 2),
      'utf-8'
    );

    return ok(undefined);
  }

  /**
   * Save connections to disk asynchronously (non-blocking)
   */
  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      logger.error('Connection', 'Error', `[ConnectionStore] Failed to persist connections`, error);
    });
  }
}

export const connectionStore = new ConnectionStore();
