import { WebSocketResponseEvents, GroupCreatePayload, GroupListPayload, GroupDeletePayload } from '../schemas';
import { groupStore } from '../services/groupStore.js';
import { GroupType, GROUP_TYPES } from '../types';
import { emitError, sendSuccessResponse } from '../utils/websocketResponse.js';
import { socketService } from '../services/socketService.js';

export async function handleGroupCreate(connectionId: string, payload: GroupCreatePayload, requestId: string): Promise<void> {
  const { canvasId, name, type } = payload;

  const groupType = type as GroupType;

  const exists = await groupStore.exists(name, groupType);
  if (exists) {
    emitError(connectionId, WebSocketResponseEvents.GROUP_CREATED, 'Group 名稱已存在', requestId, undefined, 'ALREADY_EXISTS');
    return;
  }

  const group = await groupStore.create(name, groupType);

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.GROUP_CREATED, {
    requestId,
    success: true,
    group,
  });
}

export async function handleGroupList(connectionId: string, payload: GroupListPayload, requestId: string): Promise<void> {
  const { type } = payload;

  const groupType = type as GroupType;
  const groups = await groupStore.list(groupType);

  sendSuccessResponse(connectionId, WebSocketResponseEvents.GROUP_LIST_RESULT, requestId, {
    groups,
  });
}

export async function handleGroupDelete(connectionId: string, payload: GroupDeletePayload, requestId: string): Promise<void> {
  const { canvasId, groupId } = payload;

  const type = await findGroupType(groupId);
  if (!type) {
    emitError(connectionId, WebSocketResponseEvents.GROUP_DELETED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  const hasItems = await groupStore.hasItems(groupId, type);
  if (hasItems) {
    emitError(connectionId, WebSocketResponseEvents.GROUP_DELETED, 'Group 內還有項目，無法刪除', requestId, undefined, 'GROUP_NOT_EMPTY');
    return;
  }

  const deleted = await groupStore.delete(groupId, type);
  if (!deleted) {
    emitError(connectionId, WebSocketResponseEvents.GROUP_DELETED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  socketService.emitToCanvas(canvasId, WebSocketResponseEvents.GROUP_DELETED, {
    requestId,
    success: true,
    groupId,
  });
}

async function findGroupType(groupId: string): Promise<GroupType | null> {
  for (const type of Object.values(GROUP_TYPES)) {
    const exists = await groupStore.exists(groupId, type);
    if (exists) {
      return type;
    }
  }
  return null;
}
