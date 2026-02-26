import type {FrequencyType, Schedule} from '@/types/pod'

/**
 * 格式化 Schedule 頻率為可讀文字
 */
export function formatScheduleFrequency(schedule: Schedule): string {
    const {frequency} = schedule

    switch (frequency) {
        case 'every-second':
            return '每秒'
        case 'every-x-minute':
            return `每 ${schedule.intervalMinute} 分鐘`
        case 'every-x-hour':
            return `每 ${schedule.intervalHour} 小時`
        case 'every-day':
            return `每天 ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
        case 'every-week': {
            const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']
            const days = schedule.weekdays
                .sort((a, b) => a - b)
                .map(d => weekdayNames[d])
                .join('、')
            return `每週${days} ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
        }
        default:
            return '未知頻率'
    }
}

type TriggerTimeCalculator = (schedule: Schedule, now: Date, last: Date) => Date

function calculateEverySecond(_schedule: Schedule, now: Date, last: Date): Date {
    const next = new Date(last.getTime() + 1000)
    return next > now ? next : new Date(now.getTime() + 1000)
}

function calculateEveryXMinute(schedule: Schedule, now: Date, last: Date): Date {
    const next = new Date(last.getTime() + schedule.intervalMinute * 60 * 1000)
    return next > now ? next : new Date(now.getTime() + schedule.intervalMinute * 60 * 1000)
}

function calculateEveryXHour(schedule: Schedule, now: Date, last: Date): Date {
    const next = new Date(last.getTime() + schedule.intervalHour * 60 * 60 * 1000)
    return next > now ? next : new Date(now.getTime() + schedule.intervalHour * 60 * 60 * 1000)
}

function calculateEveryDay(schedule: Schedule, now: Date): Date {
    const next = new Date(now)
    next.setHours(schedule.hour, schedule.minute, 0, 0)

    if (next <= now) {
        next.setDate(next.getDate() + 1)
    }

    return next
}

function calculateEveryWeek(schedule: Schedule, now: Date): Date {
    const sortedWeekdays = schedule.weekdays.slice().sort((a, b) => a - b)

    if (sortedWeekdays.length === 0) {
        return new Date(now.getTime() + 60 * 1000)
    }

    const currentDay = now.getDay()
    const next = new Date(now)
    next.setHours(schedule.hour, schedule.minute, 0, 0)

    const targetDay = sortedWeekdays.find(day => {
        if (day > currentDay) return true
        return day === currentDay && next > now
    })

    if (targetDay === undefined) {
        const firstDay = sortedWeekdays[0]!
        const daysToAdd = (7 - currentDay + firstDay) % 7 || 7
        next.setDate(next.getDate() + daysToAdd)
    } else {
        next.setDate(next.getDate() + (targetDay - currentDay))
    }

    return next
}

const triggerTimeCalculators: Record<FrequencyType, TriggerTimeCalculator> = {
    'every-second': calculateEverySecond,
    'every-x-minute': calculateEveryXMinute,
    'every-x-hour': calculateEveryXHour,
    'every-day': calculateEveryDay,
    'every-week': calculateEveryWeek,
}

export function getNextTriggerTime(schedule: Schedule, lastTriggeredAt?: string | null): Date {
    const now = new Date()
    const last = lastTriggeredAt ? new Date(lastTriggeredAt) : now
    const calculator = triggerTimeCalculators[schedule.frequency]

    if (!calculator) return now

    return calculator(schedule, now, last)
}

/**
 * 格式化 Schedule Tooltip 文字
 */
export function formatScheduleTooltip(schedule: Schedule): string {
    const frequency = formatScheduleFrequency(schedule)
    const nextTime = getNextTriggerTime(schedule, schedule.lastTriggeredAt)
    const timeStr = `${String(nextTime.getHours()).padStart(2, '0')}:${String(nextTime.getMinutes()).padStart(2, '0')}`

    return `${frequency} | 下次：${timeStr}`
}
