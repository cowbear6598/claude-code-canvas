<script setup lang="ts">
import {ref, onMounted, onUnmounted} from 'vue'
import {Send, Mic} from 'lucide-vue-next'
import {
  MAX_MESSAGE_LENGTH,
  TEXTAREA_MAX_HEIGHT,
  MAX_IMAGE_SIZE_BYTES,
  SUPPORTED_IMAGE_MEDIA_TYPES
} from '@/lib/constants'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'
import {useToast} from '@/composables/useToast'
import type {ContentBlock, ImageMediaType} from '@/types/websocket/requests'

interface SpeechRecognitionResult {
  readonly [index: number]: { transcript: string }
}

interface SpeechRecognitionResultList {
  readonly length: number

  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventMap {
  result: { results: SpeechRecognitionResultList }
  end: Event
  error: { error: string }
}

interface ISpeechRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventMap['result']) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionEventMap['error']) => void) | null

  start(): void

  stop(): void
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

interface ImageAttachment {
  mediaType: ImageMediaType
  base64Data: string
}

const props = defineProps<{
  isTyping?: boolean
}>()

const emit = defineEmits<{
  send: [message: string, contentBlocks?: ContentBlock[]]
}>()

const input = ref('')
const editableRef = ref<HTMLDivElement | null>(null)
const isListening = ref(false)
const recognition = ref<ISpeechRecognition | null>(null)
const {toast} = useToast()

const imageDataMap = new Map<HTMLElement, ImageAttachment>()

const moveCursorToEnd = (): void => {
  const element = editableRef.value
  if (!element) return

  const range = document.createRange()
  const selection = window.getSelection()
  if (!selection) return

  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

const updateText = (text: string): void => {
  const element = editableRef.value
  if (!element) return

  const truncated = text.slice(0, MAX_MESSAGE_LENGTH)
  input.value = truncated
  element.innerText = truncated
  moveCursorToEnd()
}

const countTextLength = (node: Node): number => {
  let length = 0

  if (node.nodeType === Node.TEXT_NODE) {
    length += node.textContent?.length || 0
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement
    if (element.nodeName === 'BR') {
      length += 1
    } else if (element.dataset.type === 'image') {
      return 0
    } else {
      for (const child of Array.from(node.childNodes)) {
        length += countTextLength(child)
      }
    }
  }

  return length
}

const handleInput = (e: Event): void => {
  const target = e.target as HTMLDivElement
  const innerText = target.innerText

  let textLength = 0
  for (const child of Array.from(target.childNodes)) {
    textLength += countTextLength(child)
  }

  if (textLength > MAX_MESSAGE_LENGTH) {
    updateText(innerText)
  } else {
    input.value = innerText
  }
}

const isValidImageType = (fileType: string): fileType is ImageMediaType => {
  return SUPPORTED_IMAGE_MEDIA_TYPES.includes(fileType as ImageMediaType)
}

const createImageAtom = (mediaType: ImageMediaType, base64Data: string): HTMLSpanElement => {
  const imageAtom = document.createElement('span')
  imageAtom.contentEditable = 'false'
  imageAtom.dataset.type = 'image'
  imageAtom.className = 'image-atom'
  imageAtom.textContent = '[image]'

  imageDataMap.set(imageAtom, {mediaType, base64Data})

  return imageAtom
}

const insertNodeAtCursor = (node: Node): void => {
  const element = editableRef.value
  if (!element) return

  const selection = window.getSelection()
  if (!selection) return

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  if (range && element.contains(range.commonAncestorContainer)) {
    range.deleteContents()
    range.insertNode(node)

    // Place cursor right after the node, no extra characters
    range.setStartAfter(node)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  } else {
    element.appendChild(node)
    moveCursorToEnd()
  }

  element.dispatchEvent(new Event('input', {bubbles: true}))
}

const insertImageAtCursor = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast({
        title: '圖片大小超過 5MB 限制',
      })
      reject(new Error('Image size exceeds limit'))
      return
    }

    if (!isValidImageType(file.type)) {
      toast({
        title: '不支援的圖片格式',
        description: '僅支援 JPEG/PNG/GIF/WebP',
      })
      reject(new Error('Unsupported image type'))
      return
    }

    const reader = new FileReader()

    reader.onload = (e): void => {
      const result = e.target?.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image'))
        return
      }

      const base64Data = result.split(',')[1]
      if (!base64Data) {
        reject(new Error('Invalid base64 data'))
        return
      }

      const imageAtom = createImageAtom(file.type as ImageMediaType, base64Data)
      insertNodeAtCursor(imageAtom)
      resolve()
    }

    reader.onerror = (): void => {
      toast({
        title: '圖片讀取失敗',
      })
      reject(new Error('FileReader error'))
    }

    reader.readAsDataURL(file)
  })
}

const findImageFile = (files: FileList | null): File | undefined => {
  if (!files || files.length === 0) return undefined
  return Array.from(files).find(file => file.type.startsWith('image/'))
}

const handlePaste = async (e: ClipboardEvent): Promise<void> => {
  const imageFile = findImageFile(e.clipboardData?.files ?? null)

  if (imageFile) {
    e.preventDefault()
    await insertImageAtCursor(imageFile).catch(() => {
    })
    return
  }

  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain')
  if (text) {
    document.execCommand('insertText', false, text)
  }
}

const handleDrop = async (e: DragEvent): Promise<void> => {
  e.preventDefault()

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
  for (const imageFile of imageFiles) {
    await insertImageAtCursor(imageFile).catch(() => {
    })
  }
}

const flushTextToBlocks = (blocks: ContentBlock[], currentText: string[]): void => {
  if (currentText.length === 0) return

  const text = currentText.join('')
  if (text.trim()) {
    blocks.push({type: 'text', text})
  }
  currentText.length = 0
}

const parseContentBlocks = (
    node: Node,
    blocks: ContentBlock[],
    currentText: string[]
): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    if (text) {
      currentText.push(text)
    }
    return
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return

  const element = node as HTMLElement

  if (element.nodeName === 'BR') {
    currentText.push('\n')
  } else if (element.dataset.type === 'image') {
    const imageData = imageDataMap.get(element)
    if (imageData) {
      flushTextToBlocks(blocks, currentText)
      blocks.push({
        type: 'image',
        mediaType: imageData.mediaType,
        base64Data: imageData.base64Data
      })
    }
  } else {
    for (const child of Array.from(element.childNodes)) {
      parseContentBlocks(child, blocks, currentText)
    }
  }
}

const buildContentBlocks = (): ContentBlock[] => {
  const element = editableRef.value
  if (!element) return []

  const blocks: ContentBlock[] = []
  const currentText: string[] = []

  for (const child of Array.from(element.childNodes)) {
    parseContentBlocks(child, blocks, currentText)
  }

  flushTextToBlocks(blocks, currentText)

  return blocks
}

const extractTextFromBlocks = (blocks: ContentBlock[]): string => {
  return blocks
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('')
}

const clearInput = (): void => {
  input.value = ''
  imageDataMap.clear()
  if (editableRef.value) {
    editableRef.value.innerHTML = ''
  }
}

const handleSend = (): void => {
  if (props.isTyping) return
  if (input.value.length > MAX_MESSAGE_LENGTH) return

  const hasContent = input.value.trim() || imageDataMap.size > 0
  if (!hasContent) return

  const blocks = buildContentBlocks()
  if (blocks.length === 0) return

  const hasImages = blocks.some(block => block.type === 'image')

  if (hasImages) {
    const textContent = extractTextFromBlocks(blocks)
    emit('send', textContent, blocks)
  } else {
    emit('send', input.value)
  }

  clearInput()
}

const isImageAtom = (node: Node | null): node is HTMLElement => {
  return node !== null &&
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).dataset.type === 'image'
}

const deleteImageAtom = (element: HTMLElement): void => {
  imageDataMap.delete(element)
  element.remove()
  editableRef.value?.dispatchEvent(new Event('input', {bubbles: true}))
}

const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.isComposing || e.keyCode === 229) return

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
    return
  }

  if (e.key === 'Backspace') {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!range.collapsed) return

    const container = range.startContainer
    const offset = range.startOffset

    // Case: cursor at element level, check node before cursor
    if (container.nodeType === Node.ELEMENT_NODE && offset > 0) {
      const nodeBefore = container.childNodes[offset - 1] as Node | undefined

      if (nodeBefore && isImageAtom(nodeBefore)) {
        e.preventDefault()
        deleteImageAtom(nodeBefore)
        return
      }
    }

    // Case: cursor at start of a text node, check previous sibling
    if (container.nodeType === Node.TEXT_NODE && offset === 0) {
      const prev = container.previousSibling
      if (isImageAtom(prev)) {
        e.preventDefault()
        deleteImageAtom(prev)
        return
      }
    }
  }
}

const toggleListening = (): void => {
  if (!recognition.value) return

  if (isListening.value) {
    recognition.value.stop()
    isListening.value = false
  } else {
    recognition.value.start()
    isListening.value = true
    editableRef.value?.focus()
  }
}

const initializeSpeechRecognition = (): void => {
  const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognitionConstructor) {
    recognition.value = null
    return
  }

  recognition.value = new SpeechRecognitionConstructor()
  recognition.value.lang = 'zh-TW'
  recognition.value.interimResults = false
  recognition.value.continuous = true

  recognition.value.onresult = (event): void => {
    const lastResult = event.results[event.results.length - 1]
    if (!lastResult) return
    const transcript = lastResult[0].transcript
    updateText(input.value + transcript)
  }

  recognition.value.onend = (): void => {
    isListening.value = false
  }

  recognition.value.onerror = (event): void => {
    isListening.value = false
    console.warn('Speech recognition error:', event.error)
  }
}

const cleanupSpeechRecognition = (): void => {
  if (!recognition.value) return

  recognition.value.stop()
  recognition.value.onresult = null
  recognition.value.onend = null
  recognition.value.onerror = null
}

onMounted(() => {
  initializeSpeechRecognition()
})

onUnmounted(() => {
  cleanupSpeechRecognition()
  imageDataMap.clear()
})
</script>

<template>
  <div class="p-4 border-t-2 border-doodle-ink">
    <div class="flex gap-2">
      <ScrollArea
          class="flex-1 border-2 border-doodle-ink rounded-lg bg-card focus-within:ring-2 focus-within:ring-primary"
          :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)', maxHeight: TEXTAREA_MAX_HEIGHT + 'px' }"
      >
        <div
            ref="editableRef"
            :contenteditable="!isTyping"
            class="px-4 py-3 font-mono text-sm outline-none leading-5 chat-input-editable"
            @input="handleInput"
            @keydown="handleKeyDown"
            @paste="handlePaste"
            @dragover.prevent
            @drop="handleDrop"
        />
      </ScrollArea>
      <button
          :disabled="isTyping"
          class="px-4 py-3 bg-doodle-green border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
          @click="handleSend"
      >
        <Send
            :size="20"
            class="text-card"
        />
      </button>
      <button
          class="px-4 py-3 border-2 border-doodle-ink rounded-lg hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
          :class="isListening ? 'bg-red-500' : 'bg-doodle-coral'"
          :style="{ boxShadow: '2px 2px 0 var(--doodle-ink)' }"
          @click="toggleListening"
      >
        <Mic
            :size="20"
            class="text-card"
            :class="{ 'animate-pulse': isListening }"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-editable:empty::before {
  content: 'Type your message...';
  color: oklch(0.55 0.02 50);
  pointer-events: none;
}

:deep(.image-atom) {
  display: inline-block;
  background-color: oklch(0.85 0.05 200);
  border: 1px solid var(--doodle-ink);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 12px;
  font-family: monospace;
  user-select: none;
  cursor: default;
}
</style>
