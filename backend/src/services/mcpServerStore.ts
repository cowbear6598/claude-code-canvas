import path from 'path';
import {v4 as uuidv4} from 'uuid';
import type {McpServer, McpServerConfig} from '../types/mcpServer.js';
import type {Result} from '../types/result.js';
import {ok, err} from '../types/result.js';
import {WriteQueue} from '../utils/writeQueue.js';
import {persistenceService} from './persistence/index.js';
import {logger} from '../utils/logger.js';

const MCP_SERVERS_FILE = 'mcp-servers.json';

export class McpServerStore {
    private servers: Map<string, McpServer> = new Map();
    private writeQueue = new WriteQueue('McpServer', 'McpServerStore');
    private dataDir: string | null = null;

    create(name: string, config: McpServerConfig): McpServer {
        const id = uuidv4();
        const server: McpServer = {id, name, config};
        this.servers.set(id, server);
        this.saveToDiskAsync();
        return server;
    }

    list(): McpServer[] {
        return Array.from(this.servers.values());
    }

    getById(id: string): McpServer | undefined {
        return this.servers.get(id);
    }

    async exists(id: string): Promise<boolean> {
        return this.servers.has(id);
    }

    update(id: string, name: string, config: McpServerConfig): McpServer | undefined {
        const server = this.servers.get(id);
        if (!server) {
            return undefined;
        }

        const updated: McpServer = {...server, name, config};
        this.servers.set(id, updated);
        this.saveToDiskAsync();
        return updated;
    }

    delete(id: string): boolean {
        const deleted = this.servers.delete(id);
        if (deleted) {
            this.saveToDiskAsync();
        }
        return deleted;
    }

    getByIds(ids: string[]): McpServer[] {
        return ids.flatMap((id) => {
            const server = this.servers.get(id);
            return server ? [server] : [];
        });
    }

    private validateServerData(server: unknown): server is McpServer {
        if (!server || typeof server !== 'object') return false;

        const s = server as Record<string, unknown>;

        if (typeof s.id !== 'string' || s.id.trim() === '') return false;
        if (typeof s.name !== 'string' || s.name.trim() === '') return false;
        if (!/^[a-zA-Z0-9_-]+$/.test(s.name)) return false;
        if (!s.config || typeof s.config !== 'object') return false;

        const config = s.config as Record<string, unknown>;

        if ('type' in config) {
            if (config.type !== 'http' && config.type !== 'sse') return false;
            if (typeof config.url !== 'string' || config.url.trim() === '') return false;
        } else {
            if (typeof config.command !== 'string' || config.command.trim() === '') return false;
        }

        return true;
    }

    async loadFromDisk(dataDir: string): Promise<Result<void>> {
        this.dataDir = dataDir;
        const filePath = path.join(dataDir, MCP_SERVERS_FILE);
        const result = await persistenceService.readJson<McpServer[]>(filePath);

        if (!result.success) {
            return err(`載入 MCP Server 資料失敗: ${result.error}`);
        }

        const servers = result.data ?? [];
        this.servers.clear();

        for (const server of servers) {
            if (!this.validateServerData(server)) {
                logger.warn('McpServer', 'Load', `[McpServerStore] 跳過結構不合格的 MCP Server: ${JSON.stringify(server)}`);
                continue;
            }
            this.servers.set(server.id, server);
        }

        logger.log('McpServer', 'Load', `[McpServerStore] 成功載入 ${this.servers.size} 個 MCP Server`);
        return ok(undefined);
    }

    async saveToDisk(dataDir: string): Promise<Result<void>> {
        const filePath = path.join(dataDir, MCP_SERVERS_FILE);
        const servers = Array.from(this.servers.values());
        return persistenceService.writeJson(filePath, servers);
    }

    saveToDiskAsync(): void {
        if (!this.dataDir) {
            return;
        }

        const dataDir = this.dataDir;
        this.writeQueue.enqueue('global', async () => {
            const result = await this.saveToDisk(dataDir);
            if (!result.success) {
                logger.error('McpServer', 'Save', `[McpServerStore] 儲存 MCP Server 資料失敗: ${result.error}`);
            }
        });
    }
}

export const mcpServerStore = new McpServerStore();
