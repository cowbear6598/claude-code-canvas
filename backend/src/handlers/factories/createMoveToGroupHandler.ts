import type { Socket } from 'socket.io';
import { WebSocketResponseEvents } from '../../schemas/index.js';
import { groupStore } from '../../services/groupStore.js';
import { GroupType } from '../../types/index.js';
import { emitError } from '../../utils/websocketResponse.js';
import { socketService } from '../../services/socketService.js';

interface MoveToGroupConfig {
  service: {
    exists: (id: string) => Promise<boolean>;
    setGroupId: (id: string, groupId: string | null) => Promise<void>;
  };
  resourceName: string;
  idField: string;
  groupType: GroupType;
  events: {
    moved: WebSocketResponseEvents;
  };
}

export function createMoveToGroupHandler(config: MoveToGroupConfig) {
  return async (socket: Socket, payload: Record<string, unknown>, requestId: string): Promise<void> => {
    const resourceId = payload[config.idField] as string;
    const groupId = payload.groupId as string | null;

    const resourceExists = await config.service.exists(resourceId);
    if (!resourceExists) {
      emitError(socket, config.events.moved, `${config.resourceName} 不存在`, requestId, undefined, 'NOT_FOUND');
      return;
    }

    if (groupId !== null) {
      const groupExists = await groupStore.exists(groupId, config.groupType);
      if (!groupExists) {
        emitError(socket, config.events.moved, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
        return;
      }
    }

    await config.service.setGroupId(resourceId, groupId);

    socketService.emitToAll(config.events.moved, {
      requestId,
      success: true,
      [config.idField]: resourceId,
      groupId,
    });
  };
}
