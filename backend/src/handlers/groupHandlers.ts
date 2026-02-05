import type { Socket } from 'socket.io';
import { WebSocketResponseEvents, GroupCreatePayload, GroupListPayload, GroupUpdatePayload, GroupDeletePayload } from '../schemas/index.js';
import { groupStore } from '../services/groupStore.js';
import { GroupType } from '../types/index.js';
import { emitError, sendSuccessResponse } from '../utils/websocketResponse.js';
import { socketService } from '../services/socketService.js';

export async function handleGroupCreate(socket: Socket, payload: GroupCreatePayload, requestId: string): Promise<void> {
  const { name, type } = payload;

  const groupType = type as GroupType;

  const exists = await groupStore.exists(name, groupType);
  if (exists) {
    emitError(socket, WebSocketResponseEvents.GROUP_CREATED, 'Group 名稱已存在', requestId, undefined, 'ALREADY_EXISTS');
    return;
  }

  const group = await groupStore.create(name, groupType);

  socketService.emitToAll(WebSocketResponseEvents.GROUP_CREATED, {
    requestId,
    success: true,
    group,
  });
}

export async function handleGroupList(socket: Socket, payload: GroupListPayload, requestId: string): Promise<void> {
  const { type } = payload;

  const groupType = type as GroupType;
  const groups = await groupStore.list(groupType);

  sendSuccessResponse(socket, WebSocketResponseEvents.GROUP_LIST_RESULT, requestId, {
    groups,
  });
}

export async function handleGroupUpdate(socket: Socket, payload: GroupUpdatePayload, requestId: string): Promise<void> {
  const { groupId, name } = payload;

  const type = await findGroupType(groupId);
  if (!type) {
    emitError(socket, WebSocketResponseEvents.GROUP_UPDATED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  const existsOldGroup = await groupStore.exists(groupId, type);
  if (!existsOldGroup) {
    emitError(socket, WebSocketResponseEvents.GROUP_UPDATED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  const existsNewGroup = await groupStore.exists(name, type);
  if (existsNewGroup && groupId !== name) {
    emitError(socket, WebSocketResponseEvents.GROUP_UPDATED, 'Group 名稱已存在', requestId, undefined, 'ALREADY_EXISTS');
    return;
  }

  const updatedGroup = await groupStore.update(groupId, name, type);
  if (!updatedGroup) {
    emitError(socket, WebSocketResponseEvents.GROUP_UPDATED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  socketService.emitToAll(WebSocketResponseEvents.GROUP_UPDATED, {
    requestId,
    success: true,
    group: updatedGroup,
  });
}

export async function handleGroupDelete(socket: Socket, payload: GroupDeletePayload, requestId: string): Promise<void> {
  const { groupId } = payload;

  const type = await findGroupType(groupId);
  if (!type) {
    emitError(socket, WebSocketResponseEvents.GROUP_DELETED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  const hasItems = await groupStore.hasItems(groupId, type);
  if (hasItems) {
    emitError(socket, WebSocketResponseEvents.GROUP_DELETED, 'Group 內還有項目，無法刪除', requestId, undefined, 'GROUP_NOT_EMPTY');
    return;
  }

  const deleted = await groupStore.delete(groupId, type);
  if (!deleted) {
    emitError(socket, WebSocketResponseEvents.GROUP_DELETED, 'Group 不存在', requestId, undefined, 'NOT_FOUND');
    return;
  }

  socketService.emitToAll(WebSocketResponseEvents.GROUP_DELETED, {
    requestId,
    success: true,
    groupId,
  });
}

async function findGroupType(groupId: string): Promise<GroupType | null> {
  for (const type of [GroupType.COMMAND, GroupType.OUTPUT_STYLE, GroupType.SUBAGENT]) {
    const exists = await groupStore.exists(groupId, type);
    if (exists) {
      return type;
    }
  }
  return null;
}
