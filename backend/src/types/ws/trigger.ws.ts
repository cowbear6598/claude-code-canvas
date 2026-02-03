export interface TriggerCreatePayload {
  requestId: string;
  canvasId: string;
  name: string;
  type: 'time';
  config: import('../trigger.js').TimeTriggerConfig;
  x: number;
  y: number;
  rotation: number;
  enabled: boolean;
}

export interface TriggerCreatedPayload {
  requestId: string;
  success: boolean;
  trigger?: import('../trigger.js').Trigger;
  error?: string;
}

export interface TriggerListResultPayload {
  requestId: string;
  success: boolean;
  triggers?: import('../trigger.js').Trigger[];
  error?: string;
}

export interface TriggerUpdatedPayload {
  requestId: string;
  success: boolean;
  trigger?: import('../trigger.js').Trigger;
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
