import type { Group } from '../group.js';

export interface GroupCreatedResponse {
  requestId: string;
  success: boolean;
  group?: Group;
  error?: string;
}

export interface GroupListResultResponse {
  requestId: string;
  success: boolean;
  groups?: Group[];
  error?: string;
}

export interface GroupUpdatedResponse {
  requestId: string;
  success: boolean;
  group?: Group;
  error?: string;
}

export interface GroupDeletedResponse {
  requestId: string;
  success: boolean;
  groupId?: string;
  error?: string;
}

export interface ItemMovedToGroupResponse {
  requestId: string;
  success: boolean;
  itemId?: string;
  groupId?: string | null;
  error?: string;
}
