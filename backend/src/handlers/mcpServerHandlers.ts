import {WebSocketResponseEvents} from '../schemas';
import type {
    McpServerCreatePayload,
    McpServerUpdatePayload,
    McpServerReadPayload,
    McpServerDeletePayload,
    PodBindMcpServerPayload,
    PodUnbindMcpServerPayload,
} from '../schemas';
import {mcpServerStore} from '../services/mcpServerStore.js';
import {mcpServerNoteStore} from '../services/noteStores.js';
import type {McpServerConfig} from '../types/mcpServer.js';
import {podStore} from '../services/podStore.js';
import {socketService} from '../services/socketService.js';
import {emitError} from '../utils/websocketResponse.js';
import {createNoteHandlers} from './factories/createNoteHandlers.js';
import {createBindHandler} from './factories/createBindHandlers.js';
import {withCanvasId, validatePod, handleResourceDelete} from '../utils/handlerHelpers.js';
import {logger} from '../utils/logger.js';

const mcpServerNoteHandlers = createNoteHandlers({
    noteStore: mcpServerNoteStore,
    events: {
        created: WebSocketResponseEvents.MCP_SERVER_NOTE_CREATED,
        listResult: WebSocketResponseEvents.MCP_SERVER_NOTE_LIST_RESULT,
        updated: WebSocketResponseEvents.MCP_SERVER_NOTE_UPDATED,
        deleted: WebSocketResponseEvents.MCP_SERVER_NOTE_DELETED,
    },
    foreignKeyField: 'mcpServerId',
    entityName: 'McpServer',
});

export const handleMcpServerNoteCreate = mcpServerNoteHandlers.handleNoteCreate;
export const handleMcpServerNoteList = mcpServerNoteHandlers.handleNoteList;
export const handleMcpServerNoteUpdate = mcpServerNoteHandlers.handleNoteUpdate;
export const handleMcpServerNoteDelete = mcpServerNoteHandlers.handleNoteDelete;

export async function handleMcpServerList(
    connectionId: string,
    _payload: unknown,
    requestId: string
): Promise<void> {
    const servers = mcpServerStore.list();
    socketService.emitToConnection(connectionId, WebSocketResponseEvents.MCP_SERVER_LIST_RESULT, {
        requestId,
        success: true,
        mcpServers: servers,
    });
}

export async function handleMcpServerCreate(
    connectionId: string,
    payload: McpServerCreatePayload,
    requestId: string
): Promise<void> {
    const {name, config} = payload;
    const server = mcpServerStore.create(name, config as McpServerConfig);

    logger.log('McpServer', 'Create', `建立 MCP Server: ${server.id} (${server.name})`);

    socketService.emitToConnection(connectionId, WebSocketResponseEvents.MCP_SERVER_CREATED, {
        requestId,
        success: true,
        mcpServer: server,
    });
}

export async function handleMcpServerUpdate(
    connectionId: string,
    payload: McpServerUpdatePayload,
    requestId: string
): Promise<void> {
    const {mcpServerId, name, config} = payload;

    const existing = mcpServerStore.getById(mcpServerId);
    if (!existing) {
        emitError(connectionId, WebSocketResponseEvents.MCP_SERVER_UPDATED, `MCP Server 找不到: ${mcpServerId}`, requestId, undefined, 'NOT_FOUND');
        return;
    }

    const updated = mcpServerStore.update(mcpServerId, name, config as McpServerConfig);

    logger.log('McpServer', 'Update', `更新 MCP Server: ${mcpServerId}`);

    socketService.emitToConnection(connectionId, WebSocketResponseEvents.MCP_SERVER_UPDATED, {
        requestId,
        success: true,
        mcpServer: {id: updated!.id, name: updated!.name},
    });
}

export async function handleMcpServerRead(
    connectionId: string,
    payload: McpServerReadPayload,
    requestId: string
): Promise<void> {
    const {mcpServerId} = payload;

    const server = mcpServerStore.getById(mcpServerId);
    if (!server) {
        emitError(connectionId, WebSocketResponseEvents.MCP_SERVER_READ_RESULT, `MCP Server 找不到: ${mcpServerId}`, requestId, undefined, 'NOT_FOUND');
        return;
    }

    socketService.emitToConnection(connectionId, WebSocketResponseEvents.MCP_SERVER_READ_RESULT, {
        requestId,
        success: true,
        mcpServer: {id: server.id, name: server.name, config: server.config},
    });
}

export async function handleMcpServerDelete(
    connectionId: string,
    payload: McpServerDeletePayload,
    requestId: string
): Promise<void> {
    const {mcpServerId} = payload;

    await handleResourceDelete({
        connectionId,
        requestId,
        resourceId: mcpServerId,
        resourceName: 'McpServer',
        responseEvent: WebSocketResponseEvents.MCP_SERVER_DELETED,
        existsCheck: () => mcpServerStore.exists(mcpServerId),
        findPodsUsing: (canvasId: string) => podStore.findByMcpServerId(canvasId, mcpServerId),
        deleteNotes: (canvasId: string) => mcpServerNoteStore.deleteByForeignKey(canvasId, mcpServerId),
        deleteResource: () => { mcpServerStore.delete(mcpServerId); return Promise.resolve(); },
        idFieldName: 'mcpServerId',
    });
}

const mcpServerBindHandler = createBindHandler({
    resourceName: 'McpServer',
    idField: 'mcpServerId',
    isMultiBind: true,
    service: mcpServerStore,
    podStoreMethod: {
        bind: (canvasId, podId, mcpServerId) => podStore.addMcpServerId(canvasId, podId, mcpServerId),
    },
    getPodResourceIds: (pod) => pod.mcpServerIds,
    skipRepositorySync: true,
    events: {
        bound: WebSocketResponseEvents.POD_MCP_SERVER_BOUND,
    },
});

export async function handlePodBindMcpServer(
    connectionId: string,
    payload: PodBindMcpServerPayload,
    requestId: string
): Promise<void> {
    return mcpServerBindHandler(connectionId, payload, requestId);
}

export const handlePodUnbindMcpServer = withCanvasId<PodUnbindMcpServerPayload>(
    WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND,
    async (connectionId: string, canvasId: string, payload: PodUnbindMcpServerPayload, requestId: string): Promise<void> => {
        const {podId, mcpServerId} = payload;

        const pod = validatePod(connectionId, podId, WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND, requestId);
        if (!pod) {
            return;
        }

        if (!pod.mcpServerIds.includes(mcpServerId)) {
            const updatedPod = podStore.getById(canvasId, podId);
            socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND, {
                requestId,
                canvasId,
                success: true,
                pod: updatedPod,
            });
            return;
        }

        podStore.removeMcpServerId(canvasId, podId, mcpServerId);

        const updatedPod = podStore.getById(canvasId, podId);

        logger.log('McpServer', 'Unbind', `從 Pod ${podId} 解綁 MCP Server ${mcpServerId}`);

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND, {
            requestId,
            canvasId,
            success: true,
            pod: updatedPod,
        });
    }
);
