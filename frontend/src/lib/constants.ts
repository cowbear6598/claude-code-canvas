import type { PodColor } from '@/types'

export const COLOR_MAP: Record<PodColor, string> = {
  blue: 'bg-doodle-blue',
  green: 'bg-doodle-green',
  coral: 'bg-doodle-coral',
  pink: 'bg-doodle-pink',
  yellow: 'bg-doodle-yellow',
}

// UI Constants
export const POD_MENU_X_OFFSET = 112
export const POD_MENU_Y_OFFSET = 50
export const MIN_POD_X = 0
export const MIN_POD_Y = 80

// Chat Constants
export const MAX_MESSAGE_LENGTH = 1000
export const MAX_MESSAGES_COUNT = 100
export const CONTENT_PREVIEW_LENGTH = 30
export const RESPONSE_PREVIEW_LENGTH = 40
export const RESPONSE_DELAY_MIN = 1000
export const RESPONSE_DELAY_MAX = 2000

// Pod Constants
export const OUTPUT_LINES_PREVIEW_COUNT = 4
export const DEFAULT_POD_ROTATION_RANGE = 10
export const MAX_POD_NAME_LENGTH = 50
