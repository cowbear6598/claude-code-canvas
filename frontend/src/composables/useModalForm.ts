import { ref } from 'vue'
import type { Ref } from 'vue'

export interface UseModalFormOptions<TValue> {
  /** 初始值，預設為空字串（單一輸入時使用） */
  initialValue?: TValue
  /** 驗證函式，回傳錯誤訊息或 null */
  validator: (value: TValue) => string | null
  /** 表單提交時執行的非同步回呼，回傳錯誤訊息或 null */
  onSubmit: (value: TValue) => Promise<string | null>
  /** 關閉時執行的回呼 */
  onClose: () => void
}

export interface UseModalFormReturn<TValue> {
  inputValue: Ref<TValue>
  isSubmitting: Ref<boolean>
  errorMessage: Ref<string>
  handleSubmit: () => Promise<void>
  handleClose: () => void
  resetForm: () => void
}

/**
 * Modal 表單共用 composable
 * 負責管理表單狀態、驗證與提交流程
 */
export function useModalForm<TValue>(
  options: UseModalFormOptions<TValue>,
): UseModalFormReturn<TValue> {
  const { initialValue, validator, onSubmit, onClose } = options

  const inputValue = ref(initialValue ?? ('' as TValue)) as Ref<TValue>
  const isSubmitting = ref(false)
  const errorMessage = ref('')

  const resetForm = (): void => {
    inputValue.value = initialValue ?? ('' as TValue)
    errorMessage.value = ''
  }

  const handleSubmit = async (): Promise<void> => {
    const validationError = validator(inputValue.value)
    if (validationError) {
      errorMessage.value = validationError
      return
    }

    isSubmitting.value = true
    errorMessage.value = ''

    const submitError = await onSubmit(inputValue.value)

    isSubmitting.value = false

    if (submitError) {
      errorMessage.value = submitError
      return
    }

    resetForm()
  }

  const handleClose = (): void => {
    onClose()
    resetForm()
  }

  return {
    inputValue,
    isSubmitting,
    errorMessage,
    handleSubmit,
    handleClose,
    resetForm,
  }
}
