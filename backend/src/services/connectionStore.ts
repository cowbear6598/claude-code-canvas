import {promises as fs} from 'fs';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import type {Connection, AnchorPosition, TriggerMode, DecideStatus, ConnectionStatus} from '../types';
import type {PersistedConnection} from '../types';
import {Result, ok, err} from '../types';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';
import {WriteQueue} from '../utils/writeQueue.js';
import {persistenceService} from './persistence/index.js';
import {readJsonFileOrDefault} from './shared/fileResourceHelpers.js';

interface CreateConnectionData {
    sourcePodId: string;
    sourceAnchor: AnchorPosition;
    targetPodId: string;
    targetAnchor: AnchorPosition;
    triggerMode?: TriggerMode;
}

class ConnectionStore {
    private connectionsByCanvas: Map<string, Map<string, Connection>> = new Map();
    private writeQueue = new WriteQueue('Connection', 'ConnectionStore');

    private getOrCreateCanvasMap(canvasId: string): Map<string, Connection> {
        let connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            connectionsMap = new Map();
            this.connectionsByCanvas.set(canvasId, connectionsMap);
        }
        return connectionsMap;
    }

    private findByField(canvasId: string, field: 'sourcePodId' | 'targetPodId', value: string): Connection[] {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) return [];
        return Array.from(connectionsMap.values()).filter(conn => conn[field] === value);
    }

    private patchConnection(canvasId: string, connectionId: string, patchFn: (connection: Connection) => void): Connection | undefined {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) return undefined;

        const connection = connectionsMap.get(connectionId);
        if (!connection) return undefined;

        patchFn(connection);
        connectionsMap.set(connectionId, connection);
        this.saveToDiskAsync(canvasId);

        return connection;
    }

    private parseStringField(obj: Record<string, unknown>, field: string, defaultValue: string): string {
        return (field in obj && typeof obj[field] === 'string') ? obj[field] as string : defaultValue;
    }

    private parsePersistedConnection(persisted: unknown): Connection | null {
        if (!persisted || typeof persisted !== 'object') return null;
        const obj = persisted as Record<string, unknown>;

        if (typeof obj.id !== 'string' || typeof obj.sourcePodId !== 'string' ||
            typeof obj.targetPodId !== 'string' || typeof obj.sourceAnchor !== 'string' ||
            typeof obj.targetAnchor !== 'string') {
            logger.warn('Connection', 'Load', '跳過無效的 connection 資料：缺少必要欄位');
            return null;
        }

        return {
            id: obj.id,
            sourcePodId: obj.sourcePodId,
            sourceAnchor: obj.sourceAnchor as AnchorPosition,
            targetPodId: obj.targetPodId,
            targetAnchor: obj.targetAnchor as AnchorPosition,
            triggerMode: this.parseStringField(obj, 'triggerMode', 'auto') as TriggerMode,
            decideStatus: this.parseStringField(obj, 'decideStatus', 'none') as DecideStatus,
            decideReason: ('decideReason' in obj && obj.decideReason !== undefined) ? obj.decideReason as string | null : null,
            connectionStatus: this.parseStringField(obj, 'connectionStatus', 'idle') as ConnectionStatus,
        };
    }

    create(canvasId: string, data: CreateConnectionData): Connection {
        const id = uuidv4();

        const connection: Connection = {
            id,
            sourcePodId: data.sourcePodId,
            sourceAnchor: data.sourceAnchor,
            targetPodId: data.targetPodId,
            targetAnchor: data.targetAnchor,
            triggerMode: data.triggerMode ?? 'auto',
            decideStatus: 'none',
            decideReason: null,
            connectionStatus: 'idle',
        };

        const connectionsMap = this.getOrCreateCanvasMap(canvasId);
        connectionsMap.set(id, connection);
        this.saveToDiskAsync(canvasId);

        return connection;
    }

    getById(canvasId: string, id: string): Connection | undefined {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        return connectionsMap?.get(id);
    }

    list(canvasId: string): Connection[] {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        return connectionsMap ? Array.from(connectionsMap.values()) : [];
    }

    delete(canvasId: string, id: string): boolean {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return false;
        }

        const deleted = connectionsMap.delete(id);
        if (deleted) {
            this.saveToDiskAsync(canvasId);
        }
        return deleted;
    }

    findByPodId(canvasId: string, podId: string): Connection[] {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return [];
        }

        return Array.from(connectionsMap.values()).filter(
            (connection) => connection.sourcePodId === podId || connection.targetPodId === podId
        );
    }

    findBySourcePodId(canvasId: string, sourcePodId: string): Connection[] {
        return this.findByField(canvasId, 'sourcePodId', sourcePodId);
    }

    findByTargetPodId(canvasId: string, targetPodId: string): Connection[] {
        return this.findByField(canvasId, 'targetPodId', targetPodId);
    }

    update(canvasId: string, id: string, updates: Partial<{ triggerMode: TriggerMode; decideStatus: DecideStatus; decideReason: string | null }>): Connection | undefined {
        return this.patchConnection(canvasId, id, (connection) => {
            if (updates.triggerMode !== undefined) {
                const oldMode = connection.triggerMode;
                connection.triggerMode = updates.triggerMode;

                if (oldMode === 'ai-decide' && (updates.triggerMode === 'auto' || updates.triggerMode === 'direct')) {
                    connection.decideStatus = 'none';
                    connection.decideReason = null;
                    connection.connectionStatus = 'idle';
                }
            }

            if (updates.decideStatus !== undefined) {
                connection.decideStatus = updates.decideStatus;
            }

            if (updates.decideReason !== undefined) {
                connection.decideReason = updates.decideReason;
            }
        });
    }

    updateConnectionStatus(canvasId: string, connectionId: string, status: ConnectionStatus): Connection | undefined {
        return this.patchConnection(canvasId, connectionId, (conn) => {
            conn.connectionStatus = status;
        });
    }

    deleteByPodId(canvasId: string, podId: string): number {
        const connectionsToDelete = this.findByPodId(canvasId, podId);

        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return 0;
        }

        for (const connection of connectionsToDelete) {
            connectionsMap.delete(connection.id);
        }

        if (connectionsToDelete.length > 0) {
            this.saveToDiskAsync(canvasId);
        }

        return connectionsToDelete.length;
    }

    async loadFromDisk(canvasId: string, canvasDataDir: string): Promise<Result<void>> {
        const connectionsFilePath = path.join(canvasDataDir, 'connections.json');

        await fs.mkdir(canvasDataDir, {recursive: true});

        const persistedConnections = await readJsonFileOrDefault<unknown>(connectionsFilePath);
        if (persistedConnections === null) {
            this.connectionsByCanvas.set(canvasId, new Map());
            return ok(undefined);
        }

        const connectionsMap = new Map<string, Connection>();
        for (const persisted of persistedConnections) {
            const connection = this.parsePersistedConnection(persisted);
            if (!connection) continue;
            connectionsMap.set(connection.id, connection);
        }

        this.connectionsByCanvas.set(canvasId, connectionsMap);

        const canvasName = canvasStore.getNameById(canvasId);
        logger.log('Connection', 'Load', `[ConnectionStore] 已載入 ${connectionsMap.size} 個連線，畫布 ${canvasName}`);
        return ok(undefined);
    }

    async saveToDisk(canvasId: string): Promise<Result<void>> {
        const canvasDataDir = canvasStore.getCanvasDataDir(canvasId);
        if (!canvasDataDir) {
            return err('Canvas not found');
        }

        const connectionsFilePath = path.join(canvasDataDir, 'connections.json');

        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        const connectionsArray = connectionsMap ? Array.from(connectionsMap.values()) : [];
        const persistedConnections: PersistedConnection[] = connectionsArray.map((connection) => ({
            id: connection.id,
            sourcePodId: connection.sourcePodId,
            sourceAnchor: connection.sourceAnchor,
            targetPodId: connection.targetPodId,
            targetAnchor: connection.targetAnchor,
            triggerMode: connection.triggerMode,
            decideStatus: connection.decideStatus,
            decideReason: connection.decideReason,
            connectionStatus: connection.connectionStatus,
        }));

        return persistenceService.writeJson(connectionsFilePath, persistedConnections);
    }

    /** 等待指定 Canvas 所有排隊中的磁碟寫入完成 */
    flushWrites(canvasId: string): Promise<void> {
        return this.writeQueue.flush(canvasId);
    }

    private saveToDiskAsync(canvasId: string): void {
        this.writeQueue.enqueue(canvasId, () => this.saveToDisk(canvasId).then(() => undefined));
    }

    updateDecideStatus(canvasId: string, connectionId: string, status: DecideStatus, reason: string | null): Connection | undefined {
        return this.update(canvasId, connectionId, {
            decideStatus: status,
            decideReason: reason,
        });
    }

    clearDecideStatusByPodId(canvasId: string, podId: string): void {
        const outgoingConnections = this.findBySourcePodId(canvasId, podId);

        for (const connection of outgoingConnections) {
            if (connection.triggerMode === 'ai-decide') {
                this.update(canvasId, connection.id, {
                    decideStatus: 'none',
                    decideReason: null,
                });
            }
        }
    }

    findByTriggerMode(canvasId: string, sourcePodId: string, triggerMode: TriggerMode): Connection[] {
        const connections = this.findBySourcePodId(canvasId, sourcePodId);
        return connections.filter(conn => conn.triggerMode === triggerMode);
    }
}

export const connectionStore = new ConnectionStore();
