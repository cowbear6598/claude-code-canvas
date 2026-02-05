import { ref } from 'vue'
import { useSkillStore } from '@/stores/note/skillStore'
import { useToast } from '@/composables/useToast'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = ['.zip']

const ERROR_INVALID_FORMAT = '檔案格式錯誤，僅支援 ZIP 檔案'
const ERROR_FILE_TOO_LARGE = '檔案大小超過 5MB 限制'
const ERROR_NETWORK_FAILED = '網路傳輸失敗，請重試'

interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * 驗證檔案格式和大小
 */
function validateFile(file: File): ValidationResult {
  // 檢查副檔名
  const fileName = file.name.toLowerCase()
  const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext))

  if (!hasValidExtension) {
    return { valid: false, error: ERROR_INVALID_FORMAT }
  }

  // 檢查 MIME type
  if (file.type && !['application/zip', 'application/x-zip-compressed', ''].includes(file.type)) {
    return { valid: false, error: ERROR_INVALID_FORMAT }
  }

  // 檢查檔案大小
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: ERROR_FILE_TOO_LARGE }
  }

  return { valid: true }
}

/**
 * 將檔案轉換為 Base64
 */
function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result as string
      // 移除 data URL 前綴 (e.g., "data:application/zip;base64,")
      const parts = result.split(',')
      const base64Data = parts.length > 1 ? parts[1] : result
      if (!base64Data) {
        reject(new Error('Base64 轉換失敗'))
        return
      }
      resolve(base64Data)
    }

    reader.onerror = () => {
      reject(new Error(ERROR_NETWORK_FAILED))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * 開啟檔案選擇對話框
 */
function openFilePicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,application/zip'

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      resolve(file || null)
    }

    input.oncancel = () => {
      resolve(null)
    }

    input.click()
  })
}

export function useSkillImport() {
  const skillStore = useSkillStore()
  const { toast } = useToast()
  const isImporting = ref(false)

  /**
   * 主要的匯入流程
   */
  const importSkill = async (): Promise<void> => {
    if (isImporting.value) {
      return
    }

    try {
      // 1. 開啟檔案選擇器
      const file = await openFilePicker()
      if (!file) {
        return
      }

      // 2. 驗證檔案
      const validation = validateFile(file)
      if (!validation.valid) {
        toast({
          title: '匯入失敗',
          description: validation.error,
          variant: 'destructive'
        })
        return
      }

      isImporting.value = true

      // 3. 轉換為 Base64
      let fileData: string
      try {
        fileData = await convertToBase64(file)
      } catch (error) {
        toast({
          title: '匯入失敗',
          description: error instanceof Error ? error.message : ERROR_NETWORK_FAILED,
          variant: 'destructive'
        })
        return
      }

      // 4. 發送到後端
      const result = await skillStore.importSkill(file.name, fileData, file.size)

      if (result.success) {
        const skillName = result.skill?.name || file.name

        if (result.isOverwrite) {
          toast({
            title: '匯入成功（已覆蓋）',
            description: `已覆蓋現有 Skill「${skillName}」`,
            variant: 'success'
          })
        } else {
          toast({
            title: '匯入成功',
            description: `已成功匯入 Skill「${skillName}」`,
            variant: 'success'
          })
        }
      } else {
        toast({
          title: '匯入失敗',
          description: result.error || '未知錯誤',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: '匯入失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive'
      })
    } finally {
      isImporting.value = false
    }
  }

  return {
    importSkill,
    isImporting
  }
}
