import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatScheduleFrequency, getNextTriggerTime, formatScheduleTooltip } from '@/utils/scheduleUtils'
import type { Schedule } from '@/types/pod'

describe('scheduleUtils', () => {
  describe('formatScheduleFrequency', () => {
    it('應該格式化「每秒」頻率', () => {
      const schedule: Schedule = {
        frequency: 'every-second',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每秒')
    })

    it('應該格式化「每 X 分鐘」頻率', () => {
      const schedule: Schedule = {
        frequency: 'every-x-minute',
        second: 0,
        intervalMinute: 5,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每 5 分鐘')
    })

    it('應該格式化「每 X 小時」頻率', () => {
      const schedule: Schedule = {
        frequency: 'every-x-hour',
        second: 0,
        intervalMinute: 0,
        intervalHour: 3,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每 3 小時')
    })

    it('應該格式化「每天」頻率', () => {
      const schedule: Schedule = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 9,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每天 09:30')
    })

    it('應該格式化「每週」頻率（單一天）', () => {
      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 14,
        minute: 0,
        weekdays: [1],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每週一 14:00')
    })

    it('應該格式化「每週」頻率（多個天）', () => {
      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1, 3, 5],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('每週一、三、五 10:00')
    })

    it('應該處理未知頻率', () => {
      const schedule = {
        frequency: 'unknown',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      } as any

      const result = formatScheduleFrequency(schedule)
      expect(result).toBe('未知頻率')
    })
  })

  describe('getNextTriggerTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('應該計算「每秒」的下次觸發時間', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-second',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getTime()).toBe(now.getTime() + 1000)
    })

    it('應該計算「每秒」的下次觸發時間（有上次觸發時間）', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-second',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: '2026-02-08T09:59:59',
      }

      const result = getNextTriggerTime(schedule, schedule.lastTriggeredAt)
      expect(result.getTime()).toBe(now.getTime() + 1000)
    })

    it('應該計算「每 X 分鐘」的下次觸發時間', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-x-minute',
        second: 0,
        intervalMinute: 5,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getTime()).toBe(now.getTime() + 5 * 60 * 1000)
    })

    it('應該計算「每 X 小時」的下次觸發時間', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-x-hour',
        second: 0,
        intervalMinute: 0,
        intervalHour: 2,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getTime()).toBe(now.getTime() + 2 * 60 * 60 * 1000)
    })

    it('應該計算「每天」的下次觸發時間（今天尚未執行）', () => {
      const now = new Date('2026-02-08T08:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getHours()).toBe(10)
      expect(result.getMinutes()).toBe(30)
      expect(result.getDate()).toBe(now.getDate())
    })

    it('應該計算「每天」的下次觸發時間（今天已執行）', () => {
      const now = new Date('2026-02-08T12:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getHours()).toBe(10)
      expect(result.getMinutes()).toBe(30)
      expect(result.getDate()).toBe(now.getDate() + 1)
    })

    it('應該計算「每週」的下次觸發時間（本週有下次）', () => {
      const now = new Date('2026-02-09T08:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [3, 5],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getDay()).toBe(3)
      expect(result.getHours()).toBe(10)
      expect(result.getMinutes()).toBe(0)
    })

    it('應該計算「每週」的下次觸發時間（需要下週）', () => {
      const now = new Date('2026-02-13T12:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(16)
    })

    it('應該計算「每週」的下次觸發時間（當天但時間已過）', () => {
      const now = new Date('2026-02-09T12:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(16)
    })

    it('應該處理「每週」空的 weekdays', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = getNextTriggerTime(schedule)
      expect(result.getTime()).toBe(now.getTime() + 60 * 1000)
    })
  })

  describe('formatScheduleTooltip', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('應該格式化排程提示（每秒）', () => {
      const now = new Date('2026-02-08T10:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-second',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 0,
        minute: 0,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleTooltip(schedule)
      const expectedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      expect(result).toBe(`每秒 | 下次：${expectedTime}`)
    })

    it('應該格式化排程提示（每天）', () => {
      const now = new Date('2026-02-08T08:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-day',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 14,
        minute: 30,
        weekdays: [],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleTooltip(schedule)
      expect(result).toBe('每天 14:30 | 下次：14:30')
    })

    it('應該格式化排程提示（每週）', () => {
      const now = new Date('2026-02-08T08:00:00')
      vi.setSystemTime(now)

      const schedule: Schedule = {
        frequency: 'every-week',
        second: 0,
        intervalMinute: 0,
        intervalHour: 0,
        hour: 10,
        minute: 0,
        weekdays: [1, 3, 5],
        enabled: true,
        lastTriggeredAt: null,
      }

      const result = formatScheduleTooltip(schedule)
      expect(result).toContain('每週一、三、五 10:00')
      expect(result).toContain('下次：')
    })
  })
})
