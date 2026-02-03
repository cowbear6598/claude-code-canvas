export type ScheduleFrequency =
  | 'every-second'
  | 'every-x-minute'
  | 'every-x-hour'
  | 'every-day'
  | 'every-week';

// 用於請求 payload，不含 lastTriggeredAt
export interface ScheduleConfigInput {
  frequency: ScheduleFrequency;
  second: number; // 0-59
  intervalMinute: number; // 1-1440
  intervalHour: number; // 1-24
  hour: number; // 0-23
  minute: number; // 0-59
  weekdays: number[]; // 0-6, 0=週日
  enabled: boolean;
}

// 完整結構，含 lastTriggeredAt
export interface ScheduleConfig extends ScheduleConfigInput {
  lastTriggeredAt: Date | null;
}

export interface PersistedScheduleConfig {
  frequency: ScheduleFrequency;
  second: number;
  intervalMinute: number;
  intervalHour: number;
  hour: number;
  minute: number;
  weekdays: number[];
  enabled: boolean;
  lastTriggeredAt: string | null;
}
