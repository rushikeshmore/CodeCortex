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

describe('searchKnowledge', () => {
  it('finds matches in constitution', async () => {
    const results = await searchKnowledge(fixture.root, 'test-project')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.file === 'constitution.md')).toBe(true)
  })

  it('finds matches in overview', async () => {
    const results = await searchKnowledge(fixture.root, 'Entry Points')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.file === 'overview.md')).toBe(true)
  })

  it('is case-insensitive', async () => {
    const results = await searchKnowledge(fixture.root, 'TYPESCRIPT')
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns empty for non-matching query', async () => {
    const results = await searchKnowledge(fixture.root, 'xyzzy_nonexistent_12345')
    expect(results).toHaveLength(0)
  })

  it('includes line number and context', async () => {
    const results = await searchKnowledge(fixture.root, 'Architecture')
    const hit = results[0]
    expect(hit).toBeDefined()
    expect(hit!.line).toBeGreaterThan(0)
    expect(hit!.context.length).toBeGreaterThan(0)
  })

  it('returns empty for missing .codecortex/', async () => {
    const results = await searchKnowledge('/tmp/nonexistent-codecortex-test', 'anything')
    expect(results).toHaveLength(0)
  })
})
