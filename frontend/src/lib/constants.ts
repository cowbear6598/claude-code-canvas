import type {PodColor} from '@/types'

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
export const HEADER_HEIGHT = 64

// Chat Constants
export const MAX_MESSAGE_LENGTH = 1000
export const CONTENT_PREVIEW_LENGTH = 30
export const RESPONSE_PREVIEW_LENGTH = 40

// Textarea Constants
export const TEXTAREA_MAX_LINES = 5
export const TEXTAREA_LINE_HEIGHT = 20
export const TEXTAREA_PADDING = 24
export const TEXTAREA_MAX_HEIGHT = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT + TEXTAREA_PADDING

// Pod Constants
export const OUTPUT_LINES_PREVIEW_COUNT = 4
export const DEFAULT_POD_ROTATION_RANGE = 2
export const MAX_POD_NAME_LENGTH = 50

// Trigger Constants
export const TRIGGER_WIDTH = 120
export const TRIGGER_HEIGHT = 70
export const TRIGGER_ANCHOR_LOCAL_X = 120
export const TRIGGER_ANCHOR_LOCAL_Y = 35
export const DEFAULT_TRIGGER_ROTATION_RANGE = 2

// Canvas Constants
export const GRID_SIZE = 20

// Pod Size
export const POD_WIDTH = 224
export const POD_HEIGHT = 168

// Note Size
export const NOTE_WIDTH = 80
export const NOTE_HEIGHT = 30

// Time Constants (ms)
export const POSITION_SYNC_DELAY_MS = 500
export const PASTE_TIMEOUT_MS = 10000

// Image Upload Constants
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const SUPPORTED_IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
