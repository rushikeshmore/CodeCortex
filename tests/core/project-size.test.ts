import { describe, it, expect } from 'vitest'
import { classifyProject, getSizeLimits, type ProjectSize } from '../../src/core/project-size.js'

describe('classifyProject', () => {
  it('classifies micro projects', () => {
    expect(classifyProject(5, 20, 1)).toBe('micro')
    expect(classifyProject(23, 605, 6)).toBe('micro')
    expect(classifyProject(30, 300, 3)).toBe('micro')
  })

  it('classifies small projects', () => {
    expect(classifyProject(57, 1313, 7)).toBe('small')
    expect(classifyProject(100, 1500, 10)).toBe('small')
    expect(classifyProject(200, 3000, 15)).toBe('small')
  })

  it('classifies medium projects', () => {
    expect(classifyProject(500, 8000, 30)).toBe('medium')
    expect(classifyProject(1000, 15000, 50)).toBe('medium')
    expect(classifyProject(2000, 40000, 60)).toBe('medium')
  })

  it('classifies large projects', () => {
    expect(classifyProject(6403, 143428, 96)).toBe('large')
    expect(classifyProject(6000, 120000, 80)).toBe('large')
  })

  it('classifies extra-large projects', () => {
    expect(classifyProject(20000, 400000, 200)).toBe('extra-large')
    expect(classifyProject(93000, 5300000, 500)).toBe('extra-large')
  })

  it('dense codebases bump up by one tier (symbols > files)', () => {
    // 50 files (micro by files) but 10K symbols (medium by symbols) → bumps to small (one tier up)
    expect(classifyProject(50, 10000, 5)).toBe('medium')
    // Actually: files=50 → small (31-200), symbols=10000 → medium (5001-50000)
    // symbolsIdx(2) > filesIdx(1), so min(1+1, 2) = 2 → medium
  })

  it('symbol bump is capped at one tier', () => {
    // 10 files (micro) but 100K symbols (large) → bumps only to small, not large
    expect(classifyProject(10, 100000, 2)).toBe('small')
  })
})

describe('getSizeLimits', () => {
  it('returns different limits for each size', () => {
    const sizes: ProjectSize[] = ['micro', 'small', 'medium', 'large', 'extra-large']

    for (const size of sizes) {
      const limits = getSizeLimits(size)
      expect(limits.moduleDocCap).toBeGreaterThan(0)
      expect(limits.graphEdgeCap).toBeGreaterThan(0)
      expect(limits.symbolMatchCap).toBeGreaterThan(0)
    }
  })

  it('micro has the highest limits (least truncation)', () => {
    const micro = getSizeLimits('micro')
    const large = getSizeLimits('large')

    expect(micro.moduleDocCap).toBeGreaterThan(large.moduleDocCap)
    expect(micro.graphEdgeCap).toBeGreaterThan(large.graphEdgeCap)
    expect(micro.symbolMatchCap).toBeGreaterThan(large.symbolMatchCap)
    expect(micro.depModuleNameCap).toBeGreaterThan(large.depModuleNameCap)
  })

  it('limits decrease monotonically from micro to extra-large', () => {
    const sizes: ProjectSize[] = ['micro', 'small', 'medium', 'large', 'extra-large']
    const allLimits = sizes.map(getSizeLimits)

    for (let i = 0; i < allLimits.length - 1; i++) {
      expect(allLimits[i]!.moduleDocCap).toBeGreaterThanOrEqual(allLimits[i + 1]!.moduleDocCap)
      expect(allLimits[i]!.graphEdgeCap).toBeGreaterThanOrEqual(allLimits[i + 1]!.graphEdgeCap)
    }
  })
})
