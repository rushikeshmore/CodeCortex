import { describe, it, expect } from 'vitest'
import { createDecision } from '../../src/core/decisions.js'

describe('createDecision', () => {
  it('creates a decision with kebab-case ID', () => {
    const decision = createDecision({
      title: 'Use tree-sitter for parsing',
      context: 'Need to extract symbols from source code',
      decision: 'Use tree-sitter native N-API bindings',
      alternatives: ['ctags', 'regex'],
      consequences: ['Requires native build'],
    })

    expect(decision.id).toBe('use-tree-sitter-for-parsing')
    expect(decision.title).toBe('Use tree-sitter for parsing')
    expect(decision.status).toBe('accepted')
    expect(decision.alternatives).toEqual(['ctags', 'regex'])
    expect(decision.consequences).toEqual(['Requires native build'])
  })

  it('truncates long IDs to 60 characters', () => {
    const decision = createDecision({
      title: 'A very long decision title that should be truncated because it exceeds sixty characters in the slug',
      context: 'test',
      decision: 'test',
    })

    expect(decision.id.length).toBeLessThanOrEqual(60)
  })

  it('defaults alternatives and consequences to empty arrays', () => {
    const decision = createDecision({
      title: 'Simple decision',
      context: 'test',
      decision: 'test',
    })

    expect(decision.alternatives).toEqual([])
    expect(decision.consequences).toEqual([])
  })

  it('sets today as the date', () => {
    const decision = createDecision({
      title: 'Test',
      context: 'test',
      decision: 'test',
    })

    expect(decision.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
