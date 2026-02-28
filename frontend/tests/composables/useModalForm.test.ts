import { describe, it, expect, vi } from 'vitest'
import { useModalForm } from '@/composables/useModalForm'

describe('useModalForm', () => {
  describe('初始狀態', () => {
    it('inputValue 預設為空字串', () => {
      const { inputValue } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })
      expect(inputValue.value).toBe('')
    })

    it('可傳入自訂初始值', () => {
      const { inputValue } = useModalForm({
        initialValue: 'hello',
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })
      expect(inputValue.value).toBe('hello')
    })

    it('isSubmitting 預設為 false', () => {
      const { isSubmitting } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })
      expect(isSubmitting.value).toBe(false)
    })

    it('errorMessage 預設為空字串', () => {
      const { errorMessage } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })
      expect(errorMessage.value).toBe('')
    })
  })

  describe('handleSubmit', () => {
    it('驗證失敗時應設定 errorMessage 並不呼叫 onSubmit', async () => {
      const onSubmit = vi.fn(async () => null)
      const { inputValue, errorMessage, handleSubmit } = useModalForm({
        validator: (v) => (v ? null : '欄位不能為空'),
        onSubmit,
        onClose: vi.fn(),
      })

      inputValue.value = ''
      await handleSubmit()

      expect(errorMessage.value).toBe('欄位不能為空')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('驗證通過時應呼叫 onSubmit', async () => {
      const onSubmit = vi.fn(async () => null)
      const { inputValue, handleSubmit } = useModalForm({
        validator: (v) => (v ? null : '欄位不能為空'),
        onSubmit,
        onClose: vi.fn(),
      })

      inputValue.value = 'valid'
      await handleSubmit()

      expect(onSubmit).toHaveBeenCalledWith('valid')
    })

    it('提交期間 isSubmitting 應為 true', async () => {
      let submittingDuringCall = false

      const { inputValue, isSubmitting, handleSubmit } = useModalForm({
        validator: () => null,
        onSubmit: async () => {
          submittingDuringCall = isSubmitting.value
          return null
        },
        onClose: vi.fn(),
      })

      inputValue.value = 'test'
      await handleSubmit()

      expect(submittingDuringCall).toBe(true)
      expect(isSubmitting.value).toBe(false)
    })

    it('onSubmit 回傳錯誤訊息時應設定 errorMessage', async () => {
      const { inputValue, errorMessage, handleSubmit } = useModalForm({
        validator: () => null,
        onSubmit: async () => '伺服器錯誤',
        onClose: vi.fn(),
      })

      inputValue.value = 'test'
      await handleSubmit()

      expect(errorMessage.value).toBe('伺服器錯誤')
    })

    it('onSubmit 成功後應重置表單', async () => {
      const { inputValue, errorMessage, handleSubmit } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'some value'
      errorMessage.value = 'previous error'
      await handleSubmit()

      expect(inputValue.value).toBe('')
      expect(errorMessage.value).toBe('')
    })

    it('onSubmit 成功後應將 inputValue 重置為初始值', async () => {
      const { inputValue, handleSubmit } = useModalForm({
        initialValue: 'init',
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'modified'
      await handleSubmit()

      expect(inputValue.value).toBe('init')
    })

    it('提交前應清除先前的 errorMessage', async () => {
      const { inputValue, errorMessage, handleSubmit } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      errorMessage.value = 'old error'
      inputValue.value = 'valid'
      await handleSubmit()

      expect(errorMessage.value).toBe('')
    })
  })

  describe('handleClose', () => {
    it('應呼叫 onClose 回呼', () => {
      const onClose = vi.fn()
      const { handleClose } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose,
      })

      handleClose()

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('應重置表單狀態', () => {
      const { inputValue, errorMessage, handleClose } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'some value'
      errorMessage.value = 'some error'
      handleClose()

      expect(inputValue.value).toBe('')
      expect(errorMessage.value).toBe('')
    })

    it('關閉後應將 inputValue 重置為初始值', () => {
      const { inputValue, handleClose } = useModalForm({
        initialValue: 'default',
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'changed'
      handleClose()

      expect(inputValue.value).toBe('default')
    })
  })

  describe('resetForm', () => {
    it('應清空 inputValue 與 errorMessage', () => {
      const { inputValue, errorMessage, resetForm } = useModalForm({
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'value'
      errorMessage.value = 'error'
      resetForm()

      expect(inputValue.value).toBe('')
      expect(errorMessage.value).toBe('')
    })

    it('有初始值時應重置為初始值', () => {
      const { inputValue, resetForm } = useModalForm({
        initialValue: 'initial',
        validator: () => null,
        onSubmit: async () => null,
        onClose: vi.fn(),
      })

      inputValue.value = 'changed'
      resetForm()

      expect(inputValue.value).toBe('initial')
    })
  })
})
