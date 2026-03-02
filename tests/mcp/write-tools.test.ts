/**
 * Tests for MCP write tools.
 *
 * Uses temp fixture directory to test write operations without
 * modifying the real .codecortex/ knowledge store.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { readFile, cortexPath } from '../../src/utils/files.js'
import { writeModuleDoc, readModuleDoc, listModuleDocs } from '../../src/core/modules.js'
import { writeDecision, createDecision, listDecisions, readDecision } from '../../src/core/decisions.js'
import { writeSession, createSession, listSessions, readSession, getLatestSession } from '../../src/core/sessions.js'
import { addPattern, readPatterns } from '../../src/core/patterns.js'
import { writeFile, ensureDir } from '../../src/utils/files.js'
import type { ModuleAnalysis } from '../../src/types/index.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('save_module_analysis (tool 11)', () => {
  it('writes module doc and can read it back', async () => {
    const analysis: ModuleAnalysis = {
      name: 'core',
      purpose: 'Core processing logic',
      dataFlow: 'Input → validate → process → output',
      publicApi: ['processData', 'Result'],
      gotchas: ['Async processing needs error boundaries'],
      dependencies: ['utils/format for output formatting'],
    }

    await writeModuleDoc(fixture.root, analysis)

    const doc = await readModuleDoc(fixture.root, 'core')
    expect(doc).not.toBeNull()
    expect(doc).toContain('Core processing logic')
    expect(doc).toContain('processData')
  })

  it('appears in module list after writing', async () => {
    const modules = await listModuleDocs(fixture.root)
    expect(modules).toContain('core')
  })
})

describe('record_decision (tool 12)', () => {
  it('writes decision and reads it back', async () => {
    const decision = createDecision({
      title: 'Use tree-sitter for parsing',
      context: 'Need to extract symbols from source code',
      decision: 'Use tree-sitter native N-API bindings',
      alternatives: ['ctags', 'regex'],
      consequences: ['Requires native build'],
    })

    await writeDecision(fixture.root, decision)

    const content = await readDecision(fixture.root, decision.id)
    expect(content).not.toBeNull()
    expect(content).toContain('Use tree-sitter for parsing')
    expect(content).toContain('ctags')
  })

  it('appears in decision list', async () => {
    const ids = await listDecisions(fixture.root)
    expect(ids).toContain('use-tree-sitter-for-parsing')
  })
})

describe('update_patterns (tool 13)', () => {
  it('adds a new pattern', async () => {
    const result = await addPattern(fixture.root, {
      name: 'Error Handling',
      description: 'All async functions should use try/catch',
      example: 'try { await process() } catch (e) { log(e) }',
      files: ['src/core/processor.ts'],
    })

    expect(result).toBe('added')

    const content = await readPatterns(fixture.root)
    expect(content).toContain('Error Handling')
    expect(content).toContain('try/catch')
  })

  it('updates an existing pattern', async () => {
    const result = await addPattern(fixture.root, {
      name: 'Error Handling',
      description: 'Updated: All functions must use Result type',
      example: 'const result: Result = process()',
      files: ['src/core/processor.ts'],
    })

    expect(result).toBe('updated')

    const content = await readPatterns(fixture.root)
    expect(content).toContain('Result type')
  })
})

describe('report_feedback (tool 14)', () => {
  it('records feedback entry', async () => {
    const dir = cortexPath(fixture.root, 'feedback')
    await ensureDir(dir)

    const entry = {
      date: new Date().toISOString(),
      file: 'modules/core.md',
      issue: 'Purpose description is outdated',
      reporter: 'agent',
    }

    const feedbackPath = cortexPath(fixture.root, 'feedback', 'log.json')
    const existing = await readFile(feedbackPath)
    const entries = existing ? JSON.parse(existing) : []
    entries.push(entry)
    await writeFile(feedbackPath, JSON.stringify(entries, null, 2))

    // Read back
    const content = await readFile(feedbackPath)
    const parsed = JSON.parse(content!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].issue).toBe('Purpose description is outdated')
    expect(parsed[0].reporter).toBe('agent')
  })

  it('appends multiple feedback entries', async () => {
    const feedbackPath = cortexPath(fixture.root, 'feedback', 'log.json')
    const existing = await readFile(feedbackPath)
    const entries = existing ? JSON.parse(existing) : []
    entries.push({
      date: new Date().toISOString(),
      file: 'patterns.md',
      issue: 'Missing pattern for logging',
      reporter: 'user',
    })
    await writeFile(feedbackPath, JSON.stringify(entries, null, 2))

    const content = await readFile(feedbackPath)
    const parsed = JSON.parse(content!)
    expect(parsed).toHaveLength(2)
  })
})

describe('session write/read round-trip', () => {
  it('writes and reads a session', async () => {
    const session = createSession({
      filesChanged: ['src/core/processor.ts'],
      modulesAffected: ['core'],
      summary: 'Test session',
    })

    await writeSession(fixture.root, session)

    const content = await readSession(fixture.root, session.id)
    expect(content).not.toBeNull()
    expect(content).toContain('Test session')
    expect(content).toContain('src/core/processor.ts')
  })

  it('getLatestSession returns the most recent', async () => {
    const latest = await getLatestSession(fixture.root)
    expect(latest).not.toBeNull()
  })

  it('listSessions returns all sessions', async () => {
    const sessions = await listSessions(fixture.root)
    expect(sessions.length).toBeGreaterThanOrEqual(1)
  })
})
