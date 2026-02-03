import {v4 as uuidv4} from 'uuid';
import {promises as fs} from 'fs';
import path from 'path';
import type {Connection, AnchorPosition} from '../types/index.js';
import type {PersistedConnection} from '../types/index.js';
import {Result, ok, err} from '../types/index.js';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';

interface CreateConnectionData {
    sourcePodId: string;
    sourceAnchor: AnchorPosition;
    targetPodId: string;
    targetAnchor: AnchorPosition;
    autoTrigger?: boolean;
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
            autoTrigger: data.autoTrigger ?? true,
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

    update(canvasId: string, id: string, updates: Partial<{ autoTrigger: boolean }>): Connection | undefined {
        const connectionsMap = this.connectionsByCanvas.get(canvasId);
        if (!connectionsMap) {
            return undefined;
        }

        const connection = connectionsMap.get(id);
        if (!connection) {
            return undefined;
        }

        if (updates.autoTrigger !== undefined) {
            connection.autoTrigger = updates.autoTrigger;
        }

        connectionsMap.set(id, connection);
        this.saveToDiskAsync(canvasId);

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
            const persistedConnections: PersistedConnection[] = JSON.parse(data);

            const connectionsMap = new Map<string, Connection>();
            for (const persisted of persistedConnections) {
                const connection: Connection = {
                    id: persisted.id,
                    sourcePodId: persisted.sourcePodId,
                    sourceAnchor: persisted.sourceAnchor,
                    targetPodId: persisted.targetPodId,
                    targetAnchor: persisted.targetAnchor,
                    autoTrigger: persisted.autoTrigger ?? false,
                    createdAt: new Date(persisted.createdAt),
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
            autoTrigger: connection.autoTrigger,
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

    async loadAllCanvases(canvasEntries: Array<{ id: string; dataDir: string }>): Promise<void> {
        for (const entry of canvasEntries) {
            await this.loadFromDisk(entry.id, entry.dataDir);
        }
    }

    clearCanvasData(canvasId: string): void {
        this.connectionsByCanvas.delete(canvasId);
    }
}

export const connectionStore = new ConnectionStore();
