import {v4 as uuidv4} from 'uuid';
import {promises as fs} from 'fs';
import path from 'path';
import type {Connection, AnchorPosition, TriggerMode, DecideStatus, ConnectionStatus} from '../types';
import type {PersistedConnection} from '../types';
import {Result, ok, err} from '../types';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';

interface CreateConnectionData {
    sourcePodId: string;
    sourceAnchor: AnchorPosition;
    targetPodId: string;
    targetAnchor: AnchorPosition;
    triggerMode?: TriggerMode;
}

class ConnectionStore {
    private connectionsByCanvas: Map<string, Map<string, Connection>> = new Map();

    private getOrCreateCanvasMap(canvasId: string): Map<string, Connection> {
        let connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            connectionsMap = new Map();
            this.connectionsByCanvas.set(canvasId, connectionsMap);
        }
        return connectionsMap;
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
            createdAt: new Date(),
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
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return [];
        }

        return Array.from(connectionsMap.values()).filter(
            (connection) => connection.sourcePodId === sourcePodId
        );
    }

    findByTargetPodId(canvasId: string, targetPodId: string): Connection[] {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return [];
        }

        return Array.from(connectionsMap.values()).filter(
            (connection) => connection.targetPodId === targetPodId
        );
    }

    update(canvasId: string, id: string, updates: Partial<{ triggerMode: TriggerMode; decideStatus: DecideStatus; decideReason: string | null }>): Connection | undefined {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return undefined;
        }

        const connection = connectionsMap.get(id);
        if (!connection) {
            return undefined;
        }

        if (updates.triggerMode !== undefined) {
            const oldMode = connection.triggerMode;
            connection.triggerMode = updates.triggerMode;

            if (oldMode === 'ai-decide' && (updates.triggerMode === 'auto' || updates.triggerMode === 'direct')) {
                connection.decideStatus = 'none';
                connection.decideReason = null;
            }
        }

        if (updates.decideStatus !== undefined) {
            connection.decideStatus = updates.decideStatus;
        }

        if (updates.decideReason !== undefined) {
            connection.decideReason = updates.decideReason;
        }

        connectionsMap.set(id, connection);
        this.saveToDiskAsync(canvasId);

        return connection;
    }

    updateConnectionStatus(canvasId: string, connectionId: string, status: ConnectionStatus): Connection | undefined {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return undefined;
        }

        const connection = connectionsMap.get(connectionId);
        if (!connection) {
            return undefined;
        }

        connection.connectionStatus = status;
        connectionsMap.set(connectionId, connection);

        return connection;
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

        try {
            await fs.access(connectionsFilePath);
        } catch {
            this.connectionsByCanvas.set(canvasId, new Map());
            return ok(undefined);
        }

        const data = await fs.readFile(connectionsFilePath, 'utf-8');

        try {
            const persistedConnections: unknown[] = JSON.parse(data);

            const connectionsMap = new Map<string, Connection>();
            for (const persisted of persistedConnections) {
                const persistedObj = persisted as Record<string, unknown>;

                const triggerMode: TriggerMode = ('triggerMode' in persistedObj && typeof persistedObj.triggerMode === 'string')
                    ? persistedObj.triggerMode as TriggerMode
                    : 'auto';

                const connection: Connection = {
                    id: persistedObj.id as string,
                    sourcePodId: persistedObj.sourcePodId as string,
                    sourceAnchor: persistedObj.sourceAnchor as AnchorPosition,
                    targetPodId: persistedObj.targetPodId as string,
                    targetAnchor: persistedObj.targetAnchor as AnchorPosition,
                    triggerMode,
                    decideStatus: ('decideStatus' in persistedObj && typeof persistedObj.decideStatus === 'string')
                        ? persistedObj.decideStatus as DecideStatus
                        : 'none',
                    decideReason: ('decideReason' in persistedObj && persistedObj.decideReason !== undefined)
                        ? persistedObj.decideReason as string | null
                        : null,
                    connectionStatus: 'idle',
                    createdAt: new Date(persistedObj.createdAt as string),
                };
                connectionsMap.set(connection.id, connection);
            }

            this.connectionsByCanvas.set(canvasId, connectionsMap);

            logger.log('Connection', 'Load', `[ConnectionStore] Loaded ${connectionsMap.size} connections for canvas ${canvasId}`);
            return ok(undefined);
        } catch (error) {
            logger.error('Connection', 'Error', `[ConnectionStore] Failed to load connections for canvas ${canvasId}`, error);
            return err('載入連線資料失敗');
        }
    }

    async saveToDisk(canvasId: string): Promise<Result<void>> {
        const canvasDataDir = canvasStore.getCanvasDataDir(canvasId);
        if (!canvasDataDir) {
            return err('Canvas not found');
        }

        const connectionsFilePath = path.join(canvasDataDir, 'connections.json');

        await fs.mkdir(canvasDataDir, {recursive: true});

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
            createdAt: connection.createdAt.toISOString(),
        }));

        await fs.writeFile(
            connectionsFilePath,
            JSON.stringify(persistedConnections, null, 2),
            'utf-8'
        );

        return ok(undefined);
    }

    private saveToDiskAsync(canvasId: string): void {
        this.saveToDisk(canvasId).catch((error) => {
            logger.error('Connection', 'Error', `[ConnectionStore] Failed to persist connections for canvas ${canvasId}`, error);
        });
    }

    /**
     * 更新單一 connection 的 AI Decide 狀態
     */
    updateDecideStatus(canvasId: string, connectionId: string, status: DecideStatus, reason: string | null): Connection | undefined {
        return this.update(canvasId, connectionId, {
            decideStatus: status,
            decideReason: reason,
        });
    }

    /**
     * 清除該 Pod 所有出站 connections 的 decideStatus 為 'none' 並清空 reason
     */
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

    /**
     * 根據 triggerMode 過濾出站 connections
     */
    findByTriggerMode(canvasId: string, sourcePodId: string, triggerMode: TriggerMode): Connection[] {
        const connections = this.findBySourcePodId(canvasId, sourcePodId);
        return connections.filter(conn => conn.triggerMode === triggerMode);
    }
}

export const connectionStore = new ConnectionStore();
