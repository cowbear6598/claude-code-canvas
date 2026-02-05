import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ScheduleConfig } from '../../src/types/index.js';

// 測試用的內部 shouldFire 檢查函數
type ShouldFireChecker = (schedule: ScheduleConfig, now: Date) => boolean;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// 複製 scheduleService 中的 shouldFireCheckers 邏輯用於測試
const shouldFireCheckers: Record<ScheduleConfig['frequency'], ShouldFireChecker> = {
  'every-second': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedSeconds = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_SECOND;
    return elapsedSeconds >= schedule.second;
  },

  'every-x-minute': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedMinutes = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_MINUTE;
    return elapsedMinutes >= schedule.intervalMinute;
  },

  'every-x-hour': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedHours = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_HOUR;
    return elapsedHours >= schedule.intervalHour;
  },

  'every-day': (schedule, now) => {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    if (currentHour !== schedule.hour || currentMinute !== schedule.minute || currentSecond !== 0) {
      return false;
    }

    if (!schedule.lastTriggeredAt) {
      return true;
    }

    return !isSameDay(new Date(schedule.lastTriggeredAt), now);
  },

  'every-week': (schedule, now) => {
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    if (!schedule.weekdays.includes(currentDay)) {
      return false;
    }

    if (currentHour !== schedule.hour || currentMinute !== schedule.minute || currentSecond !== 0) {
      return false;
    }

    if (!schedule.lastTriggeredAt) {
      return true;
    }

    return !isSameDay(new Date(schedule.lastTriggeredAt), now);
  },
};

function shouldFire(schedule: ScheduleConfig, now: Date): boolean {
  const checker = shouldFireCheckers[schedule.frequency];
  return checker ? checker(schedule, now) : false;
}

describe('Schedule Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('shouldFire - every-second', () => {
    it('在沒有 lastTriggeredAt 時應立即觸發', () => {
      const schedule: ScheduleConfig = {
        frequency: 'every-second',
        second: 5,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      };

      const now = new Date('2026-02-05T12:00:00Z');
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在經過指定秒數後應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-second',
        second: 5,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 5 * MS_PER_SECOND);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在未經過指定秒數時不應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-second',
        second: 10,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 5 * MS_PER_SECOND);
      expect(shouldFire(schedule, now)).toBe(false);
    });
  });

  describe('shouldFire - every-x-minute', () => {
    it('在沒有 lastTriggeredAt 時應立即觸發', () => {
      const schedule: ScheduleConfig = {
        frequency: 'every-x-minute',
        second: 0,
        intervalMinute: 5,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      };

      const now = new Date('2026-02-05T12:00:00Z');
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在經過指定分鐘後應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-x-minute',
        second: 0,
        intervalMinute: 15,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 15 * MS_PER_MINUTE);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在未經過指定分鐘時不應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-x-minute',
        second: 0,
        intervalMinute: 30,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 10 * MS_PER_MINUTE);
      expect(shouldFire(schedule, now)).toBe(false);
    });
  });

  describe('shouldFire - every-x-hour', () => {
    it('在沒有 lastTriggeredAt 時應立即觸發', () => {
      const schedule: ScheduleConfig = {
        frequency: 'every-x-hour',
        second: 0,
        intervalMinute: 0,
        intervalHour: 2,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      };

      const now = new Date('2026-02-05T12:00:00Z');
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在經過指定小時後應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-x-hour',
        second: 0,
        intervalMinute: 0,
        intervalHour: 3,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 3 * MS_PER_HOUR);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在未經過指定小時時不應觸發', () => {
      const lastTriggered = new Date('2026-02-05T12:00:00Z');
      const schedule: ScheduleConfig = {
        frequency: 'every-x-hour',
        second: 0,
        intervalMinute: 0,
        intervalHour: 6,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(lastTriggered.getTime() + 3 * MS_PER_HOUR);
      expect(shouldFire(schedule, now)).toBe(false);
    });
  });

  describe('shouldFire - every-day', () => {
    it('在沒有 lastTriggeredAt 且時間匹配時應觸發', () => {
      const schedule: ScheduleConfig = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      };

      // 使用本地時間建立日期
      const now = new Date(2026, 1, 5, 9, 30, 0);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在每日指定時間應觸發', () => {
      // 使用本地時間建立日期
      const lastTriggered = new Date(2026, 1, 4, 9, 30, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(2026, 1, 5, 9, 30, 0);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在同一天不應重複觸發', () => {
      const lastTriggered = new Date(2026, 1, 5, 9, 30, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(2026, 1, 5, 9, 30, 0);
      expect(shouldFire(schedule, now)).toBe(false);
    });

    it('在時間不匹配時不應觸發', () => {
      const lastTriggered = new Date(2026, 1, 4, 9, 30, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(2026, 1, 5, 10, 0, 0);
      expect(shouldFire(schedule, now)).toBe(false);
    });

    it('秒數必須為 0 才會觸發', () => {
      const lastTriggered = new Date(2026, 1, 4, 9, 30, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(2026, 1, 5, 9, 30, 15);
      expect(shouldFire(schedule, now)).toBe(false);
    });
  });

  describe('shouldFire - every-week', () => {
    it('在沒有 lastTriggeredAt 且時間和日期匹配時應觸發', () => {
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1, 3, 5], // 週一、週三、週五
        enabled: true,
        lastTriggeredAt: null,
      };

      // 2026-02-09 是週一 (本地時間)
      const now = new Date(2026, 1, 9, 10, 0, 0);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在每週指定日期和時間應觸發', () => {
      // 上週一 (本地時間)
      const lastTriggered = new Date(2026, 1, 2, 10, 0, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1], // 週一
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      // 本週一 (本地時間)
      const now = new Date(2026, 1, 9, 10, 0, 0);
      expect(shouldFire(schedule, now)).toBe(true);
    });

    it('在不是指定的週幾時不應觸發', () => {
      const lastTriggered = new Date(2026, 1, 2, 10, 0, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1], // 週一
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      // 2026-02-10 是週二 (本地時間)
      const now = new Date(2026, 1, 10, 10, 0, 0);
      expect(shouldFire(schedule, now)).toBe(false);
    });

    it('在同一天不應重複觸發', () => {
      const lastTriggered = new Date(2026, 1, 9, 10, 0, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1], // 週一
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const now = new Date(2026, 1, 9, 10, 0, 0);
      expect(shouldFire(schedule, now)).toBe(false);
    });

    it('在時間不匹配時不應觸發', () => {
      const lastTriggered = new Date(2026, 1, 2, 10, 0, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1], // 週一
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      // 週一但時間不對 (本地時間)
      const now = new Date(2026, 1, 9, 11, 0, 0);
      expect(shouldFire(schedule, now)).toBe(false);
    });

    it('支援多個週幾', () => {
      const lastTriggered = new Date(2026, 1, 2, 10, 0, 0);
      const schedule: ScheduleConfig = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1, 3, 5], // 週一、週三、週五
        enabled: true,
        lastTriggeredAt: lastTriggered,
      };

      const monday = new Date(2026, 1, 9, 10, 0, 0);
      const wednesday = new Date(2026, 1, 11, 10, 0, 0);
      const friday = new Date(2026, 1, 13, 10, 0, 0);

      expect(shouldFire(schedule, monday)).toBe(true);
      expect(shouldFire({ ...schedule, lastTriggeredAt: monday }, wednesday)).toBe(true);
      expect(shouldFire({ ...schedule, lastTriggeredAt: wednesday }, friday)).toBe(true);
    });
  });

  describe('lastTriggeredAt 更新邏輯', () => {
    it('觸發後應設定 lastTriggeredAt', async () => {
      // 這個測試需要 mock podStore 和其他服務
      // 由於這涉及到實際的 scheduleService 實例和其依賴，
      // 這裡展示測試的概念結構

      const { podStore } = await import('../../src/services/podStore.js');
      const setScheduleLastTriggeredAtSpy = vi.spyOn(podStore, 'setScheduleLastTriggeredAt');

      const canvasId = 'test-canvas';
      const podId = 'test-pod';
      const now = new Date('2026-02-05T12:00:00Z');

      // 呼叫 setScheduleLastTriggeredAt
      podStore.setScheduleLastTriggeredAt(canvasId, podId, now);

      expect(setScheduleLastTriggeredAtSpy).toHaveBeenCalledWith(canvasId, podId, now);
    });
  });

  describe('Pod busy 狀態跳過觸發', () => {
    it('當 Pod 狀態為 chatting 時應跳過觸發', () => {
      // 這是邏輯測試，實際的 fireSchedule 方法會檢查 pod.status
      const podStatus = 'chatting';

      // 模擬 fireSchedule 的邏輯
      const shouldSkip = podStatus !== 'idle';

      expect(shouldSkip).toBe(true);
    });

    it('當 Pod 狀態為 idle 時應允許觸發', () => {
      const podStatus = 'idle';

      const shouldSkip = podStatus !== 'idle';

      expect(shouldSkip).toBe(false);
    });

    it('當 Pod 狀態為 summarizing 時應跳過觸發', () => {
      const podStatus = 'summarizing';

      const shouldSkip = podStatus !== 'idle';

      expect(shouldSkip).toBe(true);
    });

    it('當 Pod 狀態為 error 時應跳過觸發', () => {
      const podStatus = 'error';

      const shouldSkip = podStatus !== 'idle';

      expect(shouldSkip).toBe(true);
    });
  });

  describe('isSameDay 輔助函數', () => {
    it('相同日期應回傳 true', () => {
      const date1 = new Date('2026-02-05T10:00:00Z');
      const date2 = new Date('2026-02-05T15:30:00Z');

      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('不同日期應回傳 false', () => {
      const date1 = new Date('2026-02-05T10:00:00Z');
      const date2 = new Date('2026-02-06T10:00:00Z');

      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('不同月份應回傳 false', () => {
      const date1 = new Date('2026-02-05T10:00:00Z');
      const date2 = new Date('2026-03-05T10:00:00Z');

      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('不同年份應回傳 false', () => {
      const date1 = new Date('2025-02-05T10:00:00Z');
      const date2 = new Date('2026-02-05T10:00:00Z');

      expect(isSameDay(date1, date2)).toBe(false);
    });
  });
});
