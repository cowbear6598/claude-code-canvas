import { describe, it, expect } from 'vitest'
import { generatePasteName, transformPods } from '@/composables/canvas/copyPaste/calculatePaste'
import type { CopiedPod } from '@/types'

describe('generatePasteName', () => {
  it('名稱已存在時加上 (1) 後綴', () => {
    expect(generatePasteName('Pod A', new Set(['Pod A']))).toBe('Pod A (1)')
  })

  it('名稱和 (1) 都存在時遞增到 (2)', () => {
    expect(generatePasteName('Pod A', new Set(['Pod A', 'Pod A (1)']))).toBe('Pod A (2)')
  })

  it('原名已有 (N) 後綴時以 baseName 為基礎遞增', () => {
    expect(generatePasteName('Pod A (1)', new Set(['Pod A (1)']))).toBe('Pod A (2)')
  })

  it('括號內非數字視為普通名稱', () => {
    expect(generatePasteName('Pod (A)', new Set(['Pod (A)']))).toBe('Pod (A) (1)')
  })

  it('連續遞增直到找到可用名稱', () => {
    expect(generatePasteName('Pod A', new Set(['Pod A', 'Pod A (1)', 'Pod A (2)', 'Pod A (3)']))).toBe('Pod A (4)')
  })

  it('名稱不存在於現有名稱中時仍加上 (1)', () => {
    expect(generatePasteName('Pod A', new Set())).toBe('Pod A (1)')
  })

  it('名稱與現有名稱不同時仍加上 (1)', () => {
    expect(generatePasteName('Pod A', new Set(['Pod B', 'Pod C']))).toBe('Pod A (1)')
  })
})

describe('transformPods with existingNames', () => {
  it('多個同名 Pod 一次貼上時各自獨立遞增', () => {
    const pods = [
      { id: '1', name: 'Pod A', x: 0, y: 0, rotation: 0 },
      { id: '2', name: 'Pod A', x: 100, y: 100, rotation: 0 },
    ] as CopiedPod[]
    const existingNames = new Set(['Pod A'])
    const result = transformPods(pods, { offsetX: 0, offsetY: 0 }, existingNames)
    expect(result[0]!.name).toBe('Pod A (1)')
    expect(result[1]!.name).toBe('Pod A (2)')
  })

  it('不同名 Pod 貼上時各自獨立遞增', () => {
    const pods = [
      { id: '1', name: 'Pod A', x: 0, y: 0, rotation: 0 },
      { id: '2', name: 'Pod B', x: 100, y: 100, rotation: 0 },
    ] as CopiedPod[]
    const existingNames = new Set(['Pod A', 'Pod B'])
    const result = transformPods(pods, { offsetX: 0, offsetY: 0 }, existingNames)
    expect(result[0]!.name).toBe('Pod A (1)')
    expect(result[1]!.name).toBe('Pod B (1)')
  })

  it('不應 mutate 傳入的 existingNames', () => {
    const pods = [
      { id: '1', name: 'Pod A', x: 0, y: 0, rotation: 0 },
    ] as CopiedPod[]
    const existingNames = new Set(['Pod A'])
    transformPods(pods, { offsetX: 0, offsetY: 0 }, existingNames)
    expect(existingNames.size).toBe(1)
    expect(existingNames.has('Pod A (1)')).toBe(false)
  })
})

describe('generatePasteName - MAX_COUNTER 保護', () => {
  it('超過 MAX_COUNTER 時停止遞增並回傳最後候選名稱', () => {
    const existingNames = new Set<string>()
    for (let i = 1; i < 9999; i++) {
      existingNames.add(`Pod A (${i})`)
    }
    const result = generatePasteName('Pod A', existingNames)
    expect(result).toBe('Pod A (9999)')
  })
})

describe('generatePasteName - baseName 截斷保護', () => {
  it('超長名稱應截斷 baseName 確保結果不超過 MAX_POD_NAME_LENGTH', () => {
    // MAX_POD_NAME_LENGTH = 50，SUFFIX_MAX_LENGTH = 7，maxBaseLength = 43
    const longName = 'A'.repeat(50)
    const result = generatePasteName(longName, new Set([longName]))
    expect(result.length).toBeLessThanOrEqual(50)
  })
})
