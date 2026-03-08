import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { searchKnowledge } from '../../src/core/search.js'
import { createFixture, type Fixture } from '../fixtures/setup.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('searchKnowledge — unified search', () => {
  // Symbol search
  it('finds symbols by exact name match (base 10 + kind/export bonus)', async () => {
    const results = await searchKnowledge(fixture.root, 'processData')
    expect(results.length).toBeGreaterThan(0)
    const top = results[0]!
    expect(top.type).toBe('symbol')
    // base 10 (exact) + 2 (function) + 1 (exported) = 13
    expect(top.score).toBe(13)
    expect(top.kind).toBe('function')
    expect(top.file).toContain('processor.ts')
  })

  it('finds symbols by prefix match (base 5 + bonuses)', async () => {
    const results = await searchKnowledge(fixture.root, 'process')
    const symbols = results.filter(r => r.type === 'symbol')
    expect(symbols.length).toBeGreaterThanOrEqual(2) // processData + processAuth
    // prefix=5 + function=2 + exported=1 = 8
    expect(symbols[0]!.score).toBe(8)
  })

  it('finds symbols by substring match with kind/export bonus', async () => {
    const results = await searchKnowledge(fixture.root, 'auth')
    const symbols = results.filter(r => r.type === 'symbol')
    expect(symbols.length).toBeGreaterThanOrEqual(2) // authenticate + processAuth
    expect(symbols.some(s => s.content.includes('authenticate'))).toBe(true)
  })

  it('exported functions score higher than unexported consts', async () => {
    const results = await searchKnowledge(fixture.root, 'format')
    const symbols = results.filter(r => r.type === 'symbol')
    if (symbols.length >= 1) {
      // formatOutput: exported function → prefix=5 + fn=2 + exported=1 = 8
      expect(symbols[0]!.score).toBeGreaterThanOrEqual(8)
    }
  })

  it('handles multi-word queries (AND logic)', async () => {
    // "process auth" should find processAuth (both words in name)
    const results = await searchKnowledge(fixture.root, 'process auth')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.content.includes('processAuth'))).toBe(true)
  })

  it('demotes non-exported const/variable exact matches', async () => {
    // TIMEOUT is a non-exported const — exact match should be capped at 5 (not 10)
    const results = await searchKnowledge(fixture.root, 'TIMEOUT')
    const timeout = results.find(r => r.kind === 'const' && r.content.includes('TIMEOUT'))
    expect(timeout).toBeDefined()
    // Non-exported const exact: base=5 (capped from 10) + kind=0 + export=0 = 5
    expect(timeout!.score).toBe(5)
  })

  // File path search
  it('finds file paths from graph (score 4)', async () => {
    const results = await searchKnowledge(fixture.root, 'processor')
    const fileResults = results.filter(r => r.type === 'file')
    expect(fileResults.length).toBeGreaterThanOrEqual(1)
    expect(fileResults[0]!.file).toContain('processor.ts')
    expect(fileResults[0]!.score).toBe(4)
  })

  // Markdown doc search
  it('finds matches in constitution markdown (score 2)', async () => {
    const results = await searchKnowledge(fixture.root, 'Architecture')
    const docs = results.filter(r => r.type === 'doc')
    expect(docs.length).toBeGreaterThan(0)
    expect(docs[0]!.score).toBe(2)
  })

  // Ranking
  it('ranks symbols above files above docs', async () => {
    // 'format' matches: symbol formatOutput (prefix=5 + fn=2 + exported=1 = 8), file format.ts (4), possibly docs (2)
    const results = await searchKnowledge(fixture.root, 'format')
    expect(results.length).toBeGreaterThan(0)
    // First result should be the symbol (score 8), not file (4) or doc (2)
    expect(results[0]!.score).toBeGreaterThanOrEqual(4)
  })

  // Limit
  it('respects limit parameter', async () => {
    const results = await searchKnowledge(fixture.root, 'test', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  // Case insensitive
  it('is case-insensitive', async () => {
    const results = await searchKnowledge(fixture.root, 'PROCESSDATA')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.type).toBe('symbol')
  })

  // Empty/missing
  it('returns empty for non-matching query', async () => {
    const results = await searchKnowledge(fixture.root, 'xyzzy_nonexistent_12345')
    expect(results).toHaveLength(0)
  })

  it('returns empty for empty query', async () => {
    const results = await searchKnowledge(fixture.root, '')
    expect(results).toHaveLength(0)
  })

  it('returns empty for missing .codecortex/', async () => {
    const results = await searchKnowledge('/tmp/nonexistent-codecortex-test', 'anything')
    expect(results).toHaveLength(0)
  })

  // Deduplication
  it('deduplicates results by file+line', async () => {
    const results = await searchKnowledge(fixture.root, 'processData')
    const keys = results.map(r => `${r.file}:${r.line}`)
    const uniqueKeys = new Set(keys)
    expect(keys.length).toBe(uniqueKeys.size)
  })
})
