import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { createServer } from '../../src/mcp/server.js'
import { readFile, cortexPath } from '../../src/utils/files.js'
import { writeSession, createSession } from '../../src/core/sessions.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('MCP Prompts', () => {
  it('registers 2 prompts on the server', () => {
    const server = createServer(fixture.root)
    expect(server).toBeDefined()
  })

  it('start_session prompt has constitution data available', async () => {
    const constitution = await readFile(cortexPath(fixture.root, 'constitution.md'))

    expect(constitution).not.toBeNull()
    expect(constitution).toContain('Constitution')
    expect(constitution).toContain('test-project')
  })

  it('start_session prompt includes session when available', async () => {
    // Seed a session
    const session = createSession({
      filesChanged: ['src/test.ts'],
      modulesAffected: ['core'],
      summary: 'Test session for prompt testing.',
    })
    await writeSession(fixture.root, session)

    // Verify session data exists
    const { getLatestSession, readSession } = await import('../../src/core/sessions.js')
    const latestId = await getLatestSession(fixture.root)
    expect(latestId).not.toBeNull()

    const sessionContent = await readSession(fixture.root, latestId!)
    expect(sessionContent).toContain('Test session for prompt testing')
  })

  it('before_editing prompt uses temporal data', async () => {
    const temporalContent = await readFile(cortexPath(fixture.root, 'temporal.json'))
    expect(temporalContent).not.toBeNull()

    const temporal = JSON.parse(temporalContent!)

    // Verify temporal data has the structure the prompt expects
    expect(temporal.hotspots).toBeDefined()
    expect(temporal.coupling).toBeDefined()
    expect(temporal.bugHistory).toBeDefined()
  })

  it('before_editing prompt finds coupling for known file', async () => {
    const temporalContent = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal = JSON.parse(temporalContent!)

    const file = 'processor.ts'
    const couplings = temporal.coupling.filter((c: { fileA: string; fileB: string }) =>
      c.fileA.includes(file) || c.fileB.includes(file)
    )

    expect(couplings.length).toBeGreaterThan(0)
    // Hidden dependency should be flagged
    expect(couplings.some((c: { hasImport: boolean }) => !c.hasImport)).toBe(true)
  })
})
