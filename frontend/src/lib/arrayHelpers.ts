/**
 * 根據 id 對陣列進行 upsert 操作：存在則更新，不存在則新增到末尾。
 * 直接修改原陣列（適用於 Vue reactive 陣列）。
 */
export function upsertById<T extends { id: string }>(items: T[], newItem: T): void {
    const index = items.findIndex(item => item.id === newItem.id)
    if (index === -1) {
        items.push(newItem)
    } else {
        items.splice(index, 1, newItem)
    }
}

/**
 * 根據 id 從陣列中移除元素，回傳新陣列。
 */
export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
    return items.filter(item => item.id !== id)
}
