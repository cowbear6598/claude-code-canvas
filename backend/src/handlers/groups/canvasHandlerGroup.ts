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
import { createHandlerGroup } from './createHandlerGroup.js';

export const canvasHandlerGroup = createHandlerGroup({
  name: 'canvas',
  handlers: [
    {
      event: WebSocketRequestEvents.CANVAS_CREATE,
      handler: handleCanvasCreate,
      schema: canvasCreateSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_CREATED,
    },
    {
      event: WebSocketRequestEvents.CANVAS_LIST,
      handler: handleCanvasList,
      schema: canvasListSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_LIST_RESULT,
    },
    {
      event: WebSocketRequestEvents.CANVAS_RENAME,
      handler: handleCanvasRename,
      schema: canvasRenameSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_RENAMED,
    },
    {
      event: WebSocketRequestEvents.CANVAS_DELETE,
      handler: handleCanvasDelete,
      schema: canvasDeleteSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_DELETED,
    },
    {
      event: WebSocketRequestEvents.CANVAS_SWITCH,
      handler: handleCanvasSwitch,
      schema: canvasSwitchSchema,
      responseEvent: WebSocketResponseEvents.CANVAS_SWITCHED,
    },
  ],
});
