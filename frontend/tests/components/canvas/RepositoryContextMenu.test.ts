import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import RepositoryContextMenu from '@/components/canvas/RepositoryContextMenu.vue'

const mockCheckIsGit = vi.fn()
const mockGetLocalBranches = vi.fn()
const mockCheckDirty = vi.fn()
const mockCheckoutBranch = vi.fn()
const mockCreateWorktree = vi.fn()
const mockDeleteBranch = vi.fn()
const mockPullLatest = vi.fn()

vi.mock('@/stores/note/repositoryStore', () => ({
  useRepositoryStore: () => ({
    checkIsGit: mockCheckIsGit,
    getLocalBranches: mockGetLocalBranches,
    checkDirty: mockCheckDirty,
    checkoutBranch: mockCheckoutBranch,
    createWorktree: mockCreateWorktree,
    deleteBranch: mockDeleteBranch,
    pullLatest: mockPullLatest,
  }),
}))

const mockShowErrorToast = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showErrorToast: mockShowErrorToast,
    showSuccessToast: vi.fn(),
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: { value: [] },
  }),
}))

vi.mock('lucide-vue-next', () => ({
  GitBranch: { name: 'GitBranch', template: '<svg />' },
  Download: { name: 'Download', template: '<svg />' },
}))

vi.mock('@/components/canvas/CreateWorktreeModal.vue', () => ({
  default: {
    name: 'CreateWorktreeModal',
    props: ['open', 'repositoryName'],
    emits: ['update:open', 'submit'],
    template: '<div />',
  },
}))

vi.mock('@/components/canvas/BranchSelectModal.vue', () => ({
  default: {
    name: 'BranchSelectModal',
    props: ['open', 'branches', 'currentBranch', 'repositoryName', 'worktreeBranches'],
    emits: ['update:open', 'select', 'delete'],
    template: '<div />',
  },
}))

vi.mock('@/components/canvas/ForceCheckoutModal.vue', () => ({
  default: {
    name: 'ForceCheckoutModal',
    props: ['open', 'targetBranch'],
    emits: ['update:open', 'force-checkout'],
    template: '<div />',
  },
}))

vi.mock('@/components/canvas/DeleteBranchModal.vue', () => ({
  default: {
    name: 'DeleteBranchModal',
    props: ['open', 'branchName'],
    emits: ['update:open', 'confirm'],
    template: '<div />',
  },
}))

vi.mock('@/components/canvas/PullLatestConfirmModal.vue', () => ({
  default: {
    name: 'PullLatestConfirmModal',
    props: ['open'],
    emits: ['update:open', 'confirm'],
    template: '<div />',
  },
}))

const defaultProps = {
  position: { x: 100, y: 100 },
  repositoryId: 'repo-123',
  repositoryName: 'test-repo',
  notePosition: { x: 50, y: 50 },
  isWorktree: false,
}

function mountMenu(props = {}) {
  return mount(RepositoryContextMenu, {
    props: { ...defaultProps, ...props },
    attachTo: document.body,
  })
}

describe('RepositoryContextMenu', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockCheckIsGit.mockResolvedValue(true)
  })

  describe('handleBranchSelect - checkDirty 失敗', () => {
    it('checkDirty 失敗時應顯示錯誤 Toast（含 error 訊息）', async () => {
      mockGetLocalBranches.mockResolvedValue({
        success: true,
        branches: ['main', 'feature'],
        currentBranch: 'main',
        worktreeBranches: [],
      })
      mockCheckDirty.mockResolvedValue({ success: false, error: '無法取得 Git 狀態' })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(mockShowErrorToast).toHaveBeenCalledWith('Git', '無法取得 Git 狀態')
    })

    it('checkDirty 失敗且無 error 訊息時應顯示預設錯誤文字', async () => {
      mockCheckDirty.mockResolvedValue({ success: false, error: undefined })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(mockShowErrorToast).toHaveBeenCalledWith('Git', '檢查修改狀態失敗')
    })

    it('checkDirty 失敗時不應執行 checkout', async () => {
      mockCheckDirty.mockResolvedValue({ success: false, error: '錯誤' })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(mockCheckoutBranch).not.toHaveBeenCalled()
    })

    it('checkDirty 失敗時應 emit close', async () => {
      mockCheckDirty.mockResolvedValue({ success: false, error: '錯誤' })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('checkDirty 成功且未修改時應執行 checkout', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: false })
      mockCheckoutBranch.mockResolvedValue({ success: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(mockShowErrorToast).not.toHaveBeenCalled()
      expect(mockCheckoutBranch).toHaveBeenCalledWith('repo-123', 'feature', false)
    })

    it('checkDirty 成功且有未提交修改時不應顯示錯誤 Toast', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }
      await vm.handleBranchSelect('feature')

      expect(mockShowErrorToast).not.toHaveBeenCalled()
      expect(mockCheckoutBranch).not.toHaveBeenCalled()
    })
  })

  describe('Modal close handlers - 使用者取消時 emit close', () => {
    it('使用者取消 WorktreeModal 時應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleWorktreeModalClose: (open: boolean) => void
      }
      vm.handleWorktreeModalClose(false)

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('使用者取消 BranchModal 時應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchModalClose: (open: boolean) => void
      }
      vm.handleBranchModalClose(false)

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('使用者取消 ForceCheckoutModal 時應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleForceCheckoutModalClose: (open: boolean) => void
      }
      vm.handleForceCheckoutModalClose(false)

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('使用者取消 DeleteBranchModal 時應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleDeleteBranchModalClose: (open: boolean) => void
      }
      vm.handleDeleteBranchModalClose(false)

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('使用者取消 PullConfirmModal 時應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handlePullConfirmModalClose: (open: boolean) => void
      }
      vm.handlePullConfirmModalClose(false)

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('Modal open 為 true 時不應 emit close', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleWorktreeModalClose: (open: boolean) => void
      }
      vm.handleWorktreeModalClose(true)

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('handleDeleteBranchConfirm - 刪除分支', () => {
    it('刪除失敗時應 emit close', async () => {
      mockDeleteBranch.mockResolvedValue({ success: false })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleDeleteBranchConfirm: () => Promise<void>
      }
      await vm.handleDeleteBranchConfirm()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('刪除成功時應重新載入分支列表', async () => {
      mockDeleteBranch.mockResolvedValue({ success: true })
      mockGetLocalBranches.mockResolvedValue({
        success: true,
        branches: ['main'],
        currentBranch: 'main',
        worktreeBranches: [],
      })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleDeleteBranchConfirm: () => Promise<void>
      }
      await vm.handleDeleteBranchConfirm()

      expect(mockGetLocalBranches).toHaveBeenCalledWith('repo-123')
    })
  })

  describe('handlePullLatestConfirm - Pull 操作', () => {
    it('Pull 完成後應 emit close', async () => {
      mockPullLatest.mockResolvedValue({ requestId: 'req-456' })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handlePullLatestConfirm: () => Promise<void>
      }
      await vm.handlePullLatestConfirm()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('Pull 完成後應 emit pull-started 並帶正確 payload', async () => {
      mockPullLatest.mockResolvedValue({ requestId: 'req-456' })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handlePullLatestConfirm: () => Promise<void>
      }
      await vm.handlePullLatestConfirm()

      expect(wrapper.emitted('pull-started')).toBeTruthy()
      expect(wrapper.emitted('pull-started')?.[0]).toEqual([
        {
          requestId: 'req-456',
          repositoryName: 'test-repo',
          repositoryId: 'repo-123',
        },
      ])
    })
  })

  describe('handleForceCheckout - Force checkout 完整流程', () => {
    it('ForceCheckout 確認後應以 force: true 呼叫 checkoutBranch', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })
      mockCheckoutBranch.mockResolvedValue({ success: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
        handleForceCheckout: () => Promise<void>
        dataState: { targetBranch: string }
        modalState: { showForceCheckout: boolean }
      }

      await vm.handleBranchSelect('feature')
      await vm.handleForceCheckout()

      expect(mockCheckoutBranch).toHaveBeenCalledWith('repo-123', 'feature', true)
    })

    it('ForceCheckout 確認後應 emit branch-switched', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })
      mockCheckoutBranch.mockResolvedValue({ success: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
        handleForceCheckout: () => Promise<void>
      }

      await vm.handleBranchSelect('feature')
      await vm.handleForceCheckout()

      expect(wrapper.emitted('branch-switched')).toBeTruthy()
    })

    it('ForceCheckout 確認後應 emit close', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })
      mockCheckoutBranch.mockResolvedValue({ success: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
        handleForceCheckout: () => Promise<void>
      }

      await vm.handleBranchSelect('feature')
      await vm.handleForceCheckout()

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('handleBranchSelect - isDirty = true 時的 ForceCheckoutModal', () => {
    it('checkDirty 返回 isDirty: true 時應開啟 ForceCheckoutModal', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
        modalState: { showForceCheckout: boolean }
      }

      await vm.handleBranchSelect('feature')

      expect(vm.modalState.showForceCheckout).toBe(true)
    })

    it('checkDirty 返回 isDirty: true 時應設定 targetBranch', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
        dataState: { targetBranch: string }
      }

      await vm.handleBranchSelect('feature')

      expect(vm.dataState.targetBranch).toBe('feature')
    })
  })

  describe('handleBranchDelete - 刪除分支流程', () => {
    it('選擇刪除分支時應設定 branchToDelete 並開啟 DeleteBranchModal', async () => {
      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchDelete: (branch: string) => void
        dataState: { branchToDelete: string }
        modalState: { showDeleteBranch: boolean; showBranch: boolean }
      }

      vm.handleBranchDelete('old-feature')

      expect(vm.dataState.branchToDelete).toBe('old-feature')
      expect(vm.modalState.showDeleteBranch).toBe(true)
      expect(vm.modalState.showBranch).toBe(false)
    })
  })

  describe('performCheckout - checkout 成功後的 emit', () => {
    it('正常 checkout（非 force）後應 emit branch-switched', async () => {
      mockCheckDirty.mockResolvedValue({ success: true, isDirty: false })
      mockCheckoutBranch.mockResolvedValue({ success: true })

      const wrapper = mountMenu()
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as {
        handleBranchSelect: (branch: string) => Promise<void>
      }

      await vm.handleBranchSelect('feature')

      expect(wrapper.emitted('branch-switched')).toBeTruthy()
    })
  })
})
