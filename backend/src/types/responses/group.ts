import type { Group } from '../group.js';

export interface GroupCreatedResponse {
  requestId: string;
  success: true;
  group: Group;
}

export interface GroupListResultResponse {
  requestId: string;
  success: true;
  groups: Group[];
}

export interface GroupUpdatedResponse {
  requestId: string;
  success: true;
  group: Group;
}

export interface GroupDeletedResponse {
  requestId: string;
  success: true;
  groupId: string;
}

export interface ItemMovedToGroupResponse {
  requestId: string;
  success: true;
  itemId: string;
  groupId: string | null;
}
