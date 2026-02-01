export type TriggerType = 'time'

export type FrequencyType = 'every-second' | 'every-x-minute' | 'every-x-hour' | 'every-day' | 'every-week'

export interface TimeTriggerConfig {
  frequency: FrequencyType
  second: number
  intervalMinute: number
  intervalHour: number
  hour: number
  minute: number
  weekdays: number[]
}

export interface Trigger {
  id: string
  name: string
  type: TriggerType
  config: TimeTriggerConfig
  x: number
  y: number
  rotation: number
  createdAt: string
  enabled: boolean
  lastTriggeredAt: string | null
}
