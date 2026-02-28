import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PodMultiBindSlot from '@/components/pod/PodMultiBindSlot.vue'

interface SlotDropTargetOptions {
  slotRef: unknown
  draggedNoteId: () => string | null
  validateDrop: (noteId: string) => boolean
  onDrop: (noteId: string) => void
}

const mockDropTargetReturn = {
  isDropTarget: { value: false },
  isInserting: { value: false },
}

const mockUseSlotDropTarget = vi.fn((_options: SlotDropTargetOptions) => mockDropTargetReturn)

vi.mock('@/composables/pod/useSlotDropTarget', () => ({
  useSlotDropTarget: (options: SlotDropTargetOptions) => mockUseSlotDropTarget(options),
}))

const mockToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

function createMockStore(overrides = {}) {
  return {
    draggedNoteId: null,
    getNoteById: vi.fn(),
    isItemBoundToPod: vi.fn().mockReturnValue(false),
    ...overrides,
  }
}

const defaultProps = {
  podId: 'pod-1',
  boundNotes: [],
  store: createMockStore(),
  label: 'MCP Server',
  duplicateToastTitle: '重複綁定',
  duplicateToastDescription: '此 MCP Server 已綁定',
  slotClass: 'mcp-slot',
  menuScrollableClass: 'scroll-area',
  itemIdField: 'mcpServerId',
}

describe('PodMultiBindSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSlotDropTarget.mockReturnValue(mockDropTargetReturn)
  })

  describe('未綁定 note 時', () => {
    it('應顯示 label 文字', () => {
      const wrapper = mount(PodMultiBindSlot, {
        props: defaultProps,
      })

      expect(wrapper.text()).toContain('MCP Server')
      wrapper.unmount()
    })
  })

  describe('重複拖入時', () => {
    it('當拖入已綁定相同 item 的 note 時應顯示 toast', () => {
      const draggedNote = {
        id: 'note-1',
        name: 'Test MCP',
        boundToPodId: null,
        mcpServerId: 'mcp-1',
      }

      const store = createMockStore({
        draggedNoteId: 'note-1',
        getNoteById: vi.fn().mockReturnValue(draggedNote),
        isItemBoundToPod: vi.fn().mockReturnValue(true),
      })

      let capturedValidateDrop: ((noteId: string) => boolean) | undefined

      mockUseSlotDropTarget.mockImplementationOnce((options: SlotDropTargetOptions) => {
        capturedValidateDrop = options.validateDrop
        return mockDropTargetReturn
      })

      mount(PodMultiBindSlot, {
        props: { ...defaultProps, store },
      })

      const result = capturedValidateDrop?.('note-1')

      expect(result).toBe(false)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '重複綁定',
          description: '此 MCP Server 已綁定',
        })
      )
    })
  })
})
