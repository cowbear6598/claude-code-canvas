import type { Trigger } from '../trigger.js';

export interface TriggerCreatedPayload {
  requestId: string;
  success: boolean;
  trigger?: Trigger;
  error?: string;
}

export interface TriggerListResultPayload {
  requestId: string;
  success: boolean;
  triggers?: Trigger[];
  error?: string;
}

export interface TriggerUpdatedPayload {
  requestId: string;
  success: boolean;
  trigger?: Trigger;
  error?: string;
}

export interface TriggerDeletedPayload {
  requestId: string;
  success: boolean;
  triggerId?: string;
  deletedConnectionIds?: string[];
  error?: string;
}

export interface TriggerFiredPayload {
  triggerId: string;
  timestamp: string;
  firedPodIds: string[];
  skippedPodIds: string[];
}
