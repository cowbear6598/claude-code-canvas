// Connection Store
// Manages Pod Connections with persistence to disk

import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import type { Connection, AnchorPosition } from '../types/index.js';
import type { PersistedConnection } from '../types/index.js';
import { config } from '../config/index.js';

interface CreateConnectionData {
  sourcePodId: string;
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
      sourcePodId: data.sourcePodId,
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
   * Load connections from disk
   */
  async loadFromDisk(): Promise<void> {
    const dataDir = path.dirname(this.connectionsFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    try {
      const data = await fs.readFile(this.connectionsFilePath, 'utf-8');
      const persistedConnections: PersistedConnection[] = JSON.parse(data);

      this.connections.clear();
      for (const persisted of persistedConnections) {
        const connection: Connection = {
          ...persisted,
          autoTrigger: persisted.autoTrigger ?? false,
          createdAt: new Date(persisted.createdAt),
        };
        this.connections.set(connection.id, connection);
      }

      console.log(`[ConnectionStore] Loaded ${this.connections.size} connections from disk`);
    } catch (readError: unknown) {
      const error = readError as { code?: string };
      if (error.code === 'ENOENT') {
        console.log('[ConnectionStore] No existing connections file found, starting fresh');
        this.connections.clear();
      } else {
        console.error(`[ConnectionStore] Failed to load connections from disk: ${readError}`);
        throw readError;
      }
    }
  }

  /**
   * Save connections to disk
   */
  async saveToDisk(): Promise<void> {
    const dataDir = path.dirname(this.connectionsFilePath);
    await fs.mkdir(dataDir, { recursive: true });

    const connectionsArray = Array.from(this.connections.values());
    const persistedConnections: PersistedConnection[] = connectionsArray.map((connection) => ({
      id: connection.id,
      sourcePodId: connection.sourcePodId,
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
  }

  /**
   * Save connections to disk asynchronously (non-blocking)
   */
  private saveToDiskAsync(): void {
    this.saveToDisk().catch((error) => {
      console.error(`[ConnectionStore] Failed to persist connections: ${error}`);
    });
  }
}

export const connectionStore = new ConnectionStore();
