import { describe, it, expect } from 'vitest'
import { upsertById, removeById } from '@/lib/arrayHelpers'

describe('arrayHelpers', () => {
    describe('upsertById', () => {
        it('不存在時應新增到末尾', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
            upsertById(items, { id: '3', name: 'C' })
            expect(items).toHaveLength(3)
            expect(items[2]).toEqual({ id: '3', name: 'C' })
        })

        it('存在時應就地更新', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
            upsertById(items, { id: '1', name: 'Updated' })
            expect(items).toHaveLength(2)
            expect(items[0]).toEqual({ id: '1', name: 'Updated' })
        })

        it('更新時應保持其他元素不變', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }]
            upsertById(items, { id: '2', name: 'Updated' })
            expect(items[0]).toEqual({ id: '1', name: 'A' })
            expect(items[1]).toEqual({ id: '2', name: 'Updated' })
            expect(items[2]).toEqual({ id: '3', name: 'C' })
        })

        it('空陣列時應新增元素', () => {
            const items: { id: string; name: string }[] = []
            upsertById(items, { id: '1', name: 'A' })
            expect(items).toHaveLength(1)
            expect(items[0]).toEqual({ id: '1', name: 'A' })
        })

        it('應直接修改原陣列（in-place mutation）', () => {
            const items = [{ id: '1', name: 'A' }]
            const originalRef = items
            upsertById(items, { id: '2', name: 'B' })
            expect(items).toBe(originalRef)
        })
    })

    describe('removeById', () => {
        it('存在時應移除該元素並回傳新陣列', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }]
            const result = removeById(items, '2')
            expect(result).toHaveLength(2)
            expect(result.find(item => item.id === '2')).toBeUndefined()
        })

        it('不存在時應回傳相同內容的新陣列', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
            const result = removeById(items, '999')
            expect(result).toHaveLength(2)
            expect(result).toEqual(items)
        })

        it('應回傳新陣列而非修改原陣列', () => {
            const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]
            const result = removeById(items, '1')
            expect(result).not.toBe(items)
            expect(items).toHaveLength(2)
        })

        it('空陣列時應回傳空陣列', () => {
            const items: { id: string; name: string }[] = []
            const result = removeById(items, '1')
            expect(result).toHaveLength(0)
        })

        it('移除唯一元素後應回傳空陣列', () => {
            const items = [{ id: '1', name: 'A' }]
            const result = removeById(items, '1')
            expect(result).toHaveLength(0)
        })
    })
})
