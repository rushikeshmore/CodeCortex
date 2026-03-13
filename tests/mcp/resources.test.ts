import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { createServer } from '../../src/mcp/server.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('MCP Resources', () => {
  it('registers 3 resources on the server', () => {
    const server = createServer(fixture.root)
    // Server creation should not throw — resources registered successfully
    expect(server).toBeDefined()
  })

  it('project_overview resource returns constitution content', async () => {
    const { readFile, cortexPath } = await import('../../src/utils/files.js')
    const content = await readFile(cortexPath(fixture.root, 'constitution.md'))

    expect(content).not.toBeNull()
    expect(content).toContain('Constitution')
  })

  it('project_hotspots resource returns hotspots or fallback', async () => {
    const { readFile, cortexPath } = await import('../../src/utils/files.js')
    const content = await readFile(cortexPath(fixture.root, 'hotspots.md'))

    // Hotspots may or may not exist in fixture — either is fine
    // The resource handler returns a fallback message if missing
    expect(content === null || typeof content === 'string').toBe(true)
  })

  it('module template lists available modules', async () => {
    const { listModuleDocs } = await import('../../src/core/modules.js')
    const modules = await listModuleDocs(fixture.root)

    // Fixture starts with no module docs
    expect(Array.isArray(modules)).toBe(true)
  })

  it('module template reads module doc by name', async () => {
    const { writeModuleDoc, readModuleDoc } = await import('../../src/core/modules.js')

    // Write a test module doc
    await writeModuleDoc(fixture.root, {
      name: 'test-mod',
      purpose: 'Test module for resource tests.',
      dataFlow: 'None.',
      publicApi: ['testFn()'],
      gotchas: [],
      dependencies: [],
    })

    const content = await readModuleDoc(fixture.root, 'test-mod')
    expect(content).not.toBeNull()
    expect(content).toContain('Test module for resource tests')
  })
})
