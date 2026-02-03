import { z } from 'zod';

const SCHEDULE_LIMITS = {
  SECOND_MIN: 0,
  SECOND_MAX: 59,
  MINUTE_MIN: 0,
  MINUTE_MAX: 59,
  HOUR_MIN: 0,
  HOUR_MAX: 23,
  INTERVAL_MINUTE_MIN: 1,
  INTERVAL_MINUTE_MAX: 1440,
  INTERVAL_HOUR_MIN: 1,
  INTERVAL_HOUR_MAX: 24,
  WEEKDAY_MIN: 0,
  WEEKDAY_MAX: 6,
} as const;

export const scheduleFrequencySchema = z.enum([
  'every-second',
  'every-x-minute',
  'every-x-hour',
  'every-day',
  'every-week',
]);

export const scheduleConfigSchema = z.object({
  frequency: scheduleFrequencySchema,
  second: z.number().int().min(SCHEDULE_LIMITS.SECOND_MIN).max(SCHEDULE_LIMITS.SECOND_MAX),
  intervalMinute: z.number().int().min(SCHEDULE_LIMITS.INTERVAL_MINUTE_MIN).max(SCHEDULE_LIMITS.INTERVAL_MINUTE_MAX),
  intervalHour: z.number().int().min(SCHEDULE_LIMITS.INTERVAL_HOUR_MIN).max(SCHEDULE_LIMITS.INTERVAL_HOUR_MAX),
  hour: z.number().int().min(SCHEDULE_LIMITS.HOUR_MIN).max(SCHEDULE_LIMITS.HOUR_MAX),
  minute: z.number().int().min(SCHEDULE_LIMITS.MINUTE_MIN).max(SCHEDULE_LIMITS.MINUTE_MAX),
  weekdays: z.array(z.number().int().min(SCHEDULE_LIMITS.WEEKDAY_MIN).max(SCHEDULE_LIMITS.WEEKDAY_MAX)),
  enabled: z.boolean(),
});
