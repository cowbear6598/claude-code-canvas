import { ref, type Ref } from 'vue'
import { useSkillStore } from '@/stores/note/skillStore'
import { useToast } from '@/composables/useToast'
import { sanitizeErrorForUser } from '@/utils/errorSanitizer'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = ['.zip']

const ERROR_INVALID_FORMAT = '檔案格式錯誤，僅支援 ZIP 檔案'
const ERROR_FILE_TOO_LARGE = '檔案大小超過 5MB 限制'
const ERROR_NETWORK_FAILED = '網路傳輸失敗，請重試'

interface ValidationResult {
  valid: boolean
  error?: string
}

const validateFile = (file: File): ValidationResult => {
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (!hasValidExtension) {
    return { valid: false, error: ERROR_INVALID_FORMAT }
  }

  if (file.type && !['application/zip', 'application/x-zip-compressed', ''].includes(file.type)) {
    return { valid: false, error: ERROR_INVALID_FORMAT }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: ERROR_FILE_TOO_LARGE }
  }

  return { valid: true }
}

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (): void => {
      const result = reader.result as string
      const parts = result.split(',')
      const base64Data = parts.length > 1 ? parts[1] : result
      if (!base64Data) {
        reject(new Error('Base64 轉換失敗'))
        return
      }
      resolve(base64Data)
    }

    reader.onerror = (): void => {
      reject(new Error(ERROR_NETWORK_FAILED))
    }

    reader.readAsDataURL(file)
  })
}

const openFilePicker = (): Promise<File | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,application/zip'

    input.onchange = (e): void => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      resolve(file || null)
    }

    input.oncancel = (): void => {
      resolve(null)
    }

    input.click()
  })
}

interface UseSkillImportReturn {
  importSkill: () => Promise<void>
  isImporting: Ref<boolean>
}

export function useSkillImport(): UseSkillImportReturn {
  const skillStore = useSkillStore()
  const { showSuccessToast, showErrorToast } = useToast()
  const isImporting = ref(false)

  const importSkill = async (): Promise<void> => {
    if (isImporting.value) {
      return
    }

    try {
      const file = await openFilePicker()
      if (!file) {
        return
      }

      const validation = validateFile(file)
      if (!validation.valid) {
        showErrorToast('Skill', '匯入失敗', validation.error)
        return
      }

      isImporting.value = true

      const fileData = await convertToBase64(file)

      const result = await skillStore.importSkill(file.name, fileData, file.size)

      if (result.success) {
        const skillName = result.skill?.name || file.name

        if (result.isOverwrite) {
          showSuccessToast('Skill', '匯入成功（已覆蓋）', skillName)
        } else {
          showSuccessToast('Skill', '匯入成功', skillName)
        }
      } else {
        showErrorToast('Skill', '匯入失敗', result.error || '未知錯誤')
      }
    } catch (error) {
      const message = sanitizeErrorForUser(error)
      showErrorToast('Skill', '匯入失敗', message)
    } finally {
      isImporting.value = false
    }
  }

  return {
    importSkill,
    isImporting
  }
}
