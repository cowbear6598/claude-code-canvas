import {WebSocketRequestEvents, WebSocketResponseEvents} from '../../schemas';
import {
    mcpServerListSchema,
    mcpServerCreateSchema,
    mcpServerUpdateSchema,
    mcpServerReadSchema,
    mcpServerDeleteSchema,
    mcpServerNoteCreateSchema,
    mcpServerNoteListSchema,
    mcpServerNoteUpdateSchema,
    mcpServerNoteDeleteSchema,
    podBindMcpServerSchema,
    podUnbindMcpServerSchema,
} from '../../schemas';
import {
    handleMcpServerList,
    handleMcpServerCreate,
    handleMcpServerUpdate,
    handleMcpServerRead,
    handleMcpServerDelete,
    handleMcpServerNoteCreate,
    handleMcpServerNoteList,
    handleMcpServerNoteUpdate,
    handleMcpServerNoteDelete,
    handlePodBindMcpServer,
    handlePodUnbindMcpServer,
} from '../mcpServerHandlers.js';
import {createHandlerGroup} from './createHandlerGroup.js';

export const mcpServerHandlerGroup = createHandlerGroup({
    name: 'mcpServer',
    handlers: [
        {
            event: WebSocketRequestEvents.MCP_SERVER_LIST,
            handler: handleMcpServerList,
            schema: mcpServerListSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_LIST_RESULT,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_CREATE,
            handler: handleMcpServerCreate,
            schema: mcpServerCreateSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_CREATED,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_UPDATE,
            handler: handleMcpServerUpdate,
            schema: mcpServerUpdateSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_UPDATED,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_READ,
            handler: handleMcpServerRead,
            schema: mcpServerReadSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_READ_RESULT,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_DELETE,
            handler: handleMcpServerDelete,
            schema: mcpServerDeleteSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_DELETED,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_NOTE_CREATE,
            handler: handleMcpServerNoteCreate,
            schema: mcpServerNoteCreateSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_NOTE_CREATED,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_NOTE_LIST,
            handler: handleMcpServerNoteList,
            schema: mcpServerNoteListSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_NOTE_LIST_RESULT,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_NOTE_UPDATE,
            handler: handleMcpServerNoteUpdate,
            schema: mcpServerNoteUpdateSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_NOTE_UPDATED,
        },
        {
            event: WebSocketRequestEvents.MCP_SERVER_NOTE_DELETE,
            handler: handleMcpServerNoteDelete,
            schema: mcpServerNoteDeleteSchema,
            responseEvent: WebSocketResponseEvents.MCP_SERVER_NOTE_DELETED,
        },
        {
            event: WebSocketRequestEvents.POD_BIND_MCP_SERVER,
            handler: handlePodBindMcpServer,
            schema: podBindMcpServerSchema,
            responseEvent: WebSocketResponseEvents.POD_MCP_SERVER_BOUND,
        },
        {
            event: WebSocketRequestEvents.POD_UNBIND_MCP_SERVER,
            handler: handlePodUnbindMcpServer,
            schema: podUnbindMcpServerSchema,
            responseEvent: WebSocketResponseEvents.POD_MCP_SERVER_UNBOUND,
        },
    ],
});
