export const truncateContent = (content: string, maxLength: number): string => {
    return content.length > maxLength
        ? `${content.slice(0, maxLength)}...`
        : content
}