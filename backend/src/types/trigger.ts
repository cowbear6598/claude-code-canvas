export type TriggerType = 'time';

export type TimeTriggerFrequency =
  | 'every-second'
  | 'every-x-minute'
  | 'every-x-hour'
  | 'every-day'
  | 'every-week';

export interface TimeTriggerConfig {
  frequency: TimeTriggerFrequency;
  second: number;
  intervalMinute: number;
  intervalHour: number;
  hour: number;
  minute: number;
  weekdays: number[];
}

export interface Trigger {
  id: string;
  name: string;
  type: TriggerType;
  config: TimeTriggerConfig;
  x: number;
  y: number;
  rotation: number;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface PersistedTrigger {
  id: string;
  name: string;
  type: TriggerType;
  config: TimeTriggerConfig;
  x: number;
  y: number;
  rotation: number;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}
