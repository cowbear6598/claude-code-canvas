import type {ContentBlock} from '@/types/websocket'

export const truncateContent = (content: string, maxLength: number): string => {
    return content.length > maxLength
        ? `${content.slice(0, maxLength)}...`
        : content
}

export const buildDisplayMessage = (blocks: ContentBlock[]): string => {
    return blocks.map(block => {
        if (block.type === 'text') {
            return block.text
        }
        return '[image]'
    }).join('')
}
