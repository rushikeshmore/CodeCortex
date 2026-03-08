import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { generateStructuralModuleDocs } from '../../src/core/module-gen.js'
import { readGraph } from '../../src/core/graph.js'
import { readModuleDoc } from '../../src/core/modules.js'
import type { SymbolRecord, TemporalData } from '../../src/types/index.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('generateStructuralModuleDocs', () => {
  it('generates module docs for all modules', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()

    const symbols: SymbolRecord[] = [
      { name: 'processData', kind: 'function', file: 'src/core/processor.ts', startLine: 5, endLine: 20, signature: 'export function processData()', exported: true },
      { name: 'formatOutput', kind: 'function', file: 'src/utils/format.ts', startLine: 3, endLine: 10, signature: 'export function formatOutput()', exported: true },
    ]

    const generated = await generateStructuralModuleDocs(fixture.root, {
      graph: graph!,
      symbols,
      temporal: null,
    })

    expect(generated).toBe(2) // core + utils
  })

  it('uses grouped file summary instead of raw file list', async () => {
    const doc = await readModuleDoc(fixture.root, 'core')
    expect(doc).not.toBeNull()

    // Should contain grouped description, not raw comma-separated file list
    // The module has .ts files so should show "implementation" group
    expect(doc).toContain('implementation')
    // Should NOT be a raw dump like "src/core/processor.ts, src/core/types.ts, ..."
    expect(doc).not.toContain('src/core/processor.ts, src/core/types.ts, src/core/index.ts')
  })

  it('caps exported symbols at 20', async () => {
    // The core module only has a few symbols, so test the cap logic directly
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()

    // Create 55 fake exported symbols (exceeds micro cap of 50)
    const manySymbols: SymbolRecord[] = Array.from({ length: 55 }, (_, i) => ({
      name: `func${i}`,
      kind: 'function' as const,
      file: 'src/utils/format.ts',
      startLine: i * 10,
      endLine: i * 10 + 5,
      signature: `export function func${i}()`,
      exported: true,
    }))

    // Delete existing utils doc to allow regeneration
    const { rm } = await import('node:fs/promises')
    const { join } = await import('node:path')
    try {
      await rm(join(fixture.root, '.codecortex', 'modules', 'utils.md'))
    } catch { /* may not exist */ }

    await generateStructuralModuleDocs(fixture.root, {
      graph: graph!,
      symbols: manySymbols,
      temporal: null,
    })

    const doc = await readModuleDoc(fixture.root, 'utils')
    expect(doc).not.toBeNull()
    expect(doc).toContain('...and 5 more')
  })

  it('does not overwrite existing module docs', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()

    // core doc already exists from first test
    const docBefore = await readModuleDoc(fixture.root, 'core')

    const generated = await generateStructuralModuleDocs(fixture.root, {
      graph: graph!,
      symbols: [],
      temporal: null,
    })

    const docAfter = await readModuleDoc(fixture.root, 'core')
    expect(docAfter).toBe(docBefore) // unchanged
    expect(generated).toBe(0) // nothing new generated
  })
})
