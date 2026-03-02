import { describe, it, expect } from 'vitest'
import { createSession } from '../../src/core/sessions.js'

describe('createSession', () => {
  it('creates a session with timestamp-based ID', () => {
    const session = createSession({
      filesChanged: ['src/core/processor.ts', 'src/utils/format.ts'],
      modulesAffected: ['core', 'utils'],
      summary: 'Updated processing logic',
    })

    expect(session.id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/)
    expect(session.filesChanged).toEqual(['src/core/processor.ts', 'src/utils/format.ts'])
    expect(session.modulesAffected).toEqual(['core', 'utils'])
    expect(session.summary).toBe('Updated processing logic')
    expect(session.decisionsRecorded).toEqual([])
  })

  it('links to previous session', () => {
    const session = createSession({
      filesChanged: [],
      modulesAffected: [],
      summary: 'Follow-up',
      previousSession: '2026-03-01T10-30-00',
    })

    expect(session.previousSession).toBe('2026-03-01T10-30-00')
  })

  it('includes decision IDs', () => {
    const session = createSession({
      filesChanged: [],
      modulesAffected: [],
      summary: 'Recorded decisions',
      decisionsRecorded: ['use-tree-sitter', 'flat-file-storage'],
    })

    expect(session.decisionsRecorded).toEqual(['use-tree-sitter', 'flat-file-storage'])
  })
})
