export type ScheduleFrequency =
  | 'every-second'
  | 'every-x-minute'
  | 'every-x-hour'
  | 'every-day'
  | 'every-week';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  second: number; // 0-59
  intervalMinute: number; // 1-1440
  intervalHour: number; // 1-24
  hour: number; // 0-23
  minute: number; // 0-59
  weekdays: number[]; // 0-6, 0=週日
  enabled: boolean;
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
