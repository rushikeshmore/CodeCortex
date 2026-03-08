import { describe, it, expect } from 'vitest'
import { truncateArray, capString, summarizeFileList } from '../../src/utils/truncate.js'

describe('truncateArray', () => {
  it('returns all items when under limit', () => {
    const result = truncateArray([1, 2, 3], 5, 'items')
    expect(result.items).toEqual([1, 2, 3])
    expect(result.truncated).toBe(false)
    expect(result.total).toBe(3)
    expect(result.message).toBeUndefined()
  })

  it('truncates when over limit', () => {
    const result = truncateArray([1, 2, 3, 4, 5], 3, 'results')
    expect(result.items).toEqual([1, 2, 3])
    expect(result.truncated).toBe(true)
    expect(result.total).toBe(5)
    expect(result.message).toContain('3 of 5')
    expect(result.message).toContain('results')
  })

  it('handles exact limit', () => {
    const result = truncateArray([1, 2, 3], 3, 'items')
    expect(result.truncated).toBe(false)
    expect(result.items).toHaveLength(3)
  })

  it('handles empty array', () => {
    const result = truncateArray([], 10, 'items')
    expect(result.items).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.total).toBe(0)
  })
})

describe('capString', () => {
  it('returns string unchanged when under limit', () => {
    expect(capString('short', 100)).toBe('short')
  })

  it('truncates long strings with notice', () => {
    const long = 'a'.repeat(200)
    const result = capString(long, 100)
    expect(result).toHaveLength(100 + '\n\n[truncated — use detail: "full" for complete data]'.length)
    expect(result).toContain('[truncated')
  })

  it('handles exact length', () => {
    const str = 'exact'
    expect(capString(str, 5)).toBe('exact')
  })
})

describe('summarizeFileList', () => {
  it('groups files by type', () => {
    const files = [
      'src/core/auth.ts',
      'src/core/auth.test.ts',
      'src/types/index.d.ts',
      'tsconfig.json',
    ]
    const result = summarizeFileList(files)
    expect(result.total).toBe(4)
    expect(result.byType['implementation']?.count).toBe(1)
    expect(result.byType['tests']?.count).toBe(1)
    expect(result.byType['types']?.count).toBe(1)
    expect(result.byType['config']?.count).toBe(1)
  })

  it('caps samples at 3 per type', () => {
    const files = [
      'src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts',
    ]
    const result = summarizeFileList(files)
    expect(result.byType['implementation']?.sample).toHaveLength(3)
    expect(result.byType['implementation']?.count).toBe(5)
  })

  it('handles empty file list', () => {
    const result = summarizeFileList([])
    expect(result.total).toBe(0)
    expect(Object.keys(result.byType)).toHaveLength(0)
  })

  it('omits empty groups', () => {
    const files = ['src/main.ts', 'src/lib.ts']
    const result = summarizeFileList(files)
    expect(result.byType['tests']).toBeUndefined()
    expect(result.byType['types']).toBeUndefined()
    expect(result.byType['config']).toBeUndefined()
    expect(result.byType['implementation']?.count).toBe(2)
  })
})
