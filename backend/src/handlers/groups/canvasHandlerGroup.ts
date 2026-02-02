import { WebSocketRequestEvents, WebSocketResponseEvents } from '../../types/index.js';
import {
  canvasCreateSchema,
  canvasListSchema,
  canvasRenameSchema,
  canvasDeleteSchema,
  canvasSwitchSchema,
} from '../../schemas/index.js';
import {
  handleCanvasCreate,
  handleCanvasList,
  handleCanvasRename,
  handleCanvasDelete,
  handleCanvasSwitch,
} from '../canvasHandlers.js';
import { createHandlerDefinition } from '../registry.js';
import type { HandlerGroup } from '../registry.js';

export const canvasHandlerGroup: HandlerGroup = {
  name: 'canvas',
  handlers: [
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_CREATE,
      handleCanvasCreate,
      canvasCreateSchema,
      WebSocketResponseEvents.CANVAS_CREATED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_LIST,
      handleCanvasList,
      canvasListSchema,
      WebSocketResponseEvents.CANVAS_LIST_RESULT
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_RENAME,
      handleCanvasRename,
      canvasRenameSchema,
      WebSocketResponseEvents.CANVAS_RENAMED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_DELETE,
      handleCanvasDelete,
      canvasDeleteSchema,
      WebSocketResponseEvents.CANVAS_DELETED
    ),
    createHandlerDefinition(
      WebSocketRequestEvents.CANVAS_SWITCH,
      handleCanvasSwitch,
      canvasSwitchSchema,
      WebSocketResponseEvents.CANVAS_SWITCHED
    ),
  ],
};
