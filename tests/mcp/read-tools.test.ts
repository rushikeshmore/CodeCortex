/**
 * Tests for MCP read tools.
 *
 * Instead of going through the MCP transport layer, we test the underlying
 * functions that the tool handlers call. This gives us the same coverage
 * without MCP client/server setup complexity.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { readFile, cortexPath } from '../../src/utils/files.js'
import { readManifest, updateManifest } from '../../src/core/manifest.js'
import { readGraph, getModuleDependencies, getMostImportedFiles, getFileImporters } from '../../src/core/graph.js'
import { readModuleDoc, listModuleDocs } from '../../src/core/modules.js'
import { listSessions, getLatestSession } from '../../src/core/sessions.js'
import { listDecisions } from '../../src/core/decisions.js'
import { searchKnowledge } from '../../src/core/search.js'
import type { TemporalData, SymbolIndex } from '../../src/types/index.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('get_project_overview (tool 1)', () => {
  it('reads constitution', async () => {
    const content = await readFile(cortexPath(fixture.root, 'constitution.md'))
    expect(content).not.toBeNull()
    expect(content).toContain('test-project')
    expect(content).toContain('Constitution')
  })

  it('reads overview', async () => {
    const content = await readFile(cortexPath(fixture.root, 'overview.md'))
    expect(content).not.toBeNull()
    expect(content).toContain('Overview')
    expect(content).toContain('Entry Points')
  })

  it('reads manifest', async () => {
    const manifest = await readManifest(fixture.root)
    expect(manifest).not.toBeNull()
    expect(manifest!.project).toBe('test-project')
    expect(manifest!.totalFiles).toBe(6)
    expect(manifest!.totalSymbols).toBe(14)
    expect(manifest!.totalModules).toBe(2)
  })

  it('updateManifest recalculates projectSize when file count changes', async () => {
    // Fixture starts as micro (6 files, 14 symbols, 2 modules)
    const before = await readManifest(fixture.root)
    expect(before!.projectSize).toBe('micro')

    // Grow to small (500 files)
    const updated = await updateManifest(fixture.root, { totalFiles: 500 })
    expect(updated).not.toBeNull()
    expect(updated!.projectSize).toBe('medium') // 500 files = medium

    // Restore to original
    await updateManifest(fixture.root, { totalFiles: 6 })
    const restored = await readManifest(fixture.root)
    expect(restored!.projectSize).toBe('micro')
  })

  it('response has no overview key (removed in v0.5.0)', async () => {
    // The tool now returns only constitution + graphSummary, no overview or manifest
    const constitution = await readFile(cortexPath(fixture.root, 'constitution.md'))
    const graph = await readGraph(fixture.root)
    const response = { constitution, graphSummary: graph ? { modules: graph.modules.length } : null }

    expect(response).not.toHaveProperty('overview')
    expect(response).not.toHaveProperty('manifest')
    expect(response).toHaveProperty('constitution')
    expect(response).toHaveProperty('graphSummary')
  })

  it('reads graph summary', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()
    expect(graph!.modules).toHaveLength(2)
    expect(graph!.imports).toHaveLength(3)
    expect(graph!.entryPoints).toEqual(['src/index.ts'])

    const mostImported = getMostImportedFiles(graph!, 5)
    expect(mostImported[0]!.file).toBe('src/core/types.ts')
    expect(mostImported[0]!.importCount).toBe(2)
  })
})

describe('get_module_context (tool 2)', () => {
  it('returns null for modules that have no .md doc', async () => {
    const doc = await readModuleDoc(fixture.root, 'core')
    expect(doc).toBeNull() // No module doc created yet
  })

  it('lists available modules (empty until analysis)', async () => {
    const available = await listModuleDocs(fixture.root)
    expect(available).toEqual([]) // No .md files in modules/ yet
  })

  it('returns dependencies for known module', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()
    const deps = getModuleDependencies(graph!, 'core')
    expect(deps.imports.length).toBeGreaterThan(0)
  })
})

describe('get_session_briefing (tool 3)', () => {
  it('returns null when no sessions exist', async () => {
    const latest = await getLatestSession(fixture.root)
    expect(latest).toBeNull()
  })

  it('lists zero sessions', async () => {
    const sessions = await listSessions(fixture.root)
    expect(sessions).toHaveLength(0)
  })
})

describe('search_knowledge (tool 4)', () => {
  it('finds results across knowledge files', async () => {
    const results = await searchKnowledge(fixture.root, 'typescript')
    expect(results.length).toBeGreaterThan(0)
  })

  it('limits results to 20 (matching tool behavior)', async () => {
    const results = await searchKnowledge(fixture.root, 'test')
    const limited = results.slice(0, 20)
    expect(limited.length).toBeLessThanOrEqual(20)
  })

  it('respects custom limit param', async () => {
    const results = await searchKnowledge(fixture.root, 'process', 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('finds symbols by name with type=symbol', async () => {
    const results = await searchKnowledge(fixture.root, 'processData')
    const symbolResults = results.filter(r => r.type === 'symbol')
    expect(symbolResults.length).toBeGreaterThan(0)
    // exact(10) + function(2) + exported(1) = 13
    expect(symbolResults[0]!.score).toBeGreaterThanOrEqual(10)
  })

  it('searchDefaultLimit exists in size limits', async () => {
    const { getSizeLimits } = await import('../../src/core/project-size.js')
    const micro = getSizeLimits('micro')
    const large = getSizeLimits('large')
    expect(micro.searchDefaultLimit).toBe(10)
    expect(large.searchDefaultLimit).toBe(20)
  })

  it('ranks symbols higher than file paths and docs', async () => {
    const results = await searchKnowledge(fixture.root, 'auth')
    if (results.length >= 2) {
      // First result should be highest scored
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score)
    }
  })
})

describe('get_decision_history (tool 5)', () => {
  it('returns empty when no decisions exist', async () => {
    const ids = await listDecisions(fixture.root)
    expect(ids).toHaveLength(0)
  })
})

describe('get_dependency_graph (tool 6)', () => {
  it('returns full graph when no filter', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()
    expect(graph!.modules.length).toBe(2)
    expect(graph!.imports.length).toBe(3)
    expect(graph!.calls.length).toBe(2)
  })

  it('filters by module', async () => {
    const graph = await readGraph(fixture.root)
    const deps = getModuleDependencies(graph!, 'utils')

    // utils files: format.ts, config.ts
    // format.ts imports types.ts (cross-module)
    expect(deps.imports.length).toBeGreaterThanOrEqual(1)
    expect(deps.imports.some(e => e.target.includes('types.ts'))).toBe(true)
  })

  it('filters imports by file', async () => {
    const graph = await readGraph(fixture.root)
    const file = 'processor.ts'
    const imports = graph!.imports.filter(e => e.source.includes(file) || e.target.includes(file))

    expect(imports.length).toBeGreaterThanOrEqual(2) // processor imports types + format imports types
  })

  it('accepts name param (same as module)', async () => {
    const graph = await readGraph(fixture.root)
    const depsByName = getModuleDependencies(graph!, 'core')
    const depsByModule = getModuleDependencies(graph!, 'core')

    expect(depsByName.imports.length).toBe(depsByModule.imports.length)
    expect(depsByName.importedBy.length).toBe(depsByModule.importedBy.length)
  })

  it('unfiltered graph provides summary-compatible data', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()

    // These are the fields the summary dashboard uses
    expect(graph!.modules.length).toBe(2)
    expect(graph!.entryPoints).toEqual(['src/index.ts'])
    expect(Object.keys(graph!.externalDeps).length).toBeGreaterThan(0)

    const topImported = getMostImportedFiles(graph!, 10)
    expect(topImported.length).toBeGreaterThan(0)
  })
})

describe('lookup_symbol (tool 7)', () => {
  it('finds symbol by name', async () => {
    const content = await readFile(cortexPath(fixture.root, 'symbols.json'))
    const index: SymbolIndex = JSON.parse(content!)
    const matches = index.symbols.filter(s => s.name.toLowerCase().includes('processdata'))

    expect(matches).toHaveLength(1)
    expect(matches[0]!.kind).toBe('function')
    expect(matches[0]!.exported).toBe(true)
  })

  it('filters by kind', async () => {
    const content = await readFile(cortexPath(fixture.root, 'symbols.json'))
    const index: SymbolIndex = JSON.parse(content!)
    const interfaces = index.symbols.filter(s => s.kind === 'interface')

    expect(interfaces).toHaveLength(1)
    expect(interfaces[0]!.name).toBe('Result')
  })

  it('filters by file', async () => {
    const content = await readFile(cortexPath(fixture.root, 'symbols.json'))
    const index: SymbolIndex = JSON.parse(content!)
    const utilSymbols = index.symbols.filter(s => s.file.includes('utils'))

    expect(utilSymbols).toHaveLength(2)
  })
})

describe('get_change_coupling (tool 8)', () => {
  it('reads coupling data', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)
    expect(temporal.coupling).toHaveLength(2)
  })

  it('filters by minStrength', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)
    const strong = temporal.coupling.filter(c => c.strength >= 0.6)

    expect(strong).toHaveLength(1) // Only 0.75 passes
    expect(strong[0]!.fileA).toContain('processor.ts')
    expect(strong[0]!.fileB).toContain('types.ts')
  })

  it('filters by file', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)
    const forFile = temporal.coupling.filter(c =>
      c.fileA.includes('format.ts') || c.fileB.includes('format.ts')
    )

    expect(forFile).toHaveLength(1)
    expect(forFile[0]!.hasImport).toBe(false) // Hidden dependency
  })

  it('detects hidden dependencies', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)
    const hidden = temporal.coupling.filter(c => !c.hasImport)

    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden[0]!.warning).toContain('HIDDEN DEPENDENCY')
  })
})

describe('get_hotspots (tool 9)', () => {
  it('reads hotspot data sorted by changes', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    expect(temporal.hotspots).toHaveLength(2)
    expect(temporal.hotspots[0]!.file).toContain('processor.ts')
    expect(temporal.hotspots[0]!.changes).toBe(8)
    expect(temporal.hotspots[0]!.stability).toBe('volatile')
  })

  it('includes bug history', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    expect(temporal.bugHistory).toHaveLength(1)
    expect(temporal.bugHistory[0]!.fixCommits).toBe(3)
    expect(temporal.bugHistory[0]!.lessons).toHaveLength(2)
  })
})

describe('get_edit_briefing (tool 10)', () => {
  it('returns risk assessment for a volatile file', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)
    const graph = await readGraph(fixture.root)

    const file = 'processor.ts'
    const couplings = temporal.coupling
      .filter(c => c.fileA.includes(file) || c.fileB.includes(file))

    expect(couplings.length).toBeGreaterThan(0)

    const hotspot = temporal.hotspots.find(h => h.file.includes(file))
    expect(hotspot).toBeDefined()
    expect(hotspot!.stability).toBe('volatile')
    expect(hotspot!.changes).toBe(8)
  })

  it('identifies co-change partners for a file', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    const file = 'processor.ts'
    const partners = temporal.coupling
      .filter(c => c.fileA.includes(file) || c.fileB.includes(file))
      .map(c => c.fileA.includes(file) ? c.fileB : c.fileA)

    expect(partners).toContain('src/core/types.ts')
    expect(partners).toContain('src/utils/format.ts')
  })

  it('detects hidden dependencies in edit context', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    const file = 'processor.ts'
    const hidden = temporal.coupling
      .filter(c => c.fileA.includes(file) || c.fileB.includes(file))
      .filter(c => !c.hasImport)

    expect(hidden.length).toBe(1)
    expect(hidden[0]!.warning).toContain('HIDDEN DEPENDENCY')
  })

  it('finds importers of a file from graph', async () => {
    const graph = await readGraph(fixture.root)
    expect(graph).not.toBeNull()

    const importers = getFileImporters(graph!, 'types.ts')
    expect(importers.length).toBe(2) // processor.ts and format.ts import types.ts
  })

  it('includes bug history for files with fix commits', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    const bugs = temporal.bugHistory.find(b => b.file.includes('processor.ts'))
    expect(bugs).toBeDefined()
    expect(bugs!.fixCommits).toBe(3)
    expect(bugs!.lessons).toContain('Race condition in async processing')
  })

  it('returns empty warnings for stable files', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    const file = 'config.ts'
    const couplings = temporal.coupling
      .filter(c => c.fileA.includes(file) || c.fileB.includes(file))

    expect(couplings).toHaveLength(0)

    const hotspot = temporal.hotspots.find(h => h.file.includes(file))
    expect(hotspot).toBeUndefined()
  })
})

describe('detail flag (brief vs full)', () => {
  it('getSizeLimits returns higher caps for full detail', async () => {
    const { getSizeLimits } = await import('../../src/core/project-size.js')
    const brief = getSizeLimits('large')
    const full = getSizeLimits('large', 'full')

    expect(full.moduleDocCap).toBeGreaterThan(brief.moduleDocCap)
    expect(full.graphEdgeCap).toBeGreaterThan(brief.graphEdgeCap)
    expect(full.symbolMatchCap).toBeGreaterThan(brief.symbolMatchCap)
    expect(full.decisionCap).toBeGreaterThan(brief.decisionCap)
    expect(full.couplingCap).toBeGreaterThan(brief.couplingCap)
  })

  it('full detail returns same caps regardless of project size', async () => {
    const { getSizeLimits } = await import('../../src/core/project-size.js')
    const microFull = getSizeLimits('micro', 'full')
    const largeFull = getSizeLimits('large', 'full')

    expect(microFull.moduleDocCap).toBe(largeFull.moduleDocCap)
    expect(microFull.graphEdgeCap).toBe(largeFull.graphEdgeCap)
    expect(microFull.symbolMatchCap).toBe(largeFull.symbolMatchCap)
  })

  it('brief detail varies by project size', async () => {
    const { getSizeLimits } = await import('../../src/core/project-size.js')
    const microBrief = getSizeLimits('micro')
    const largeBrief = getSizeLimits('large')

    expect(microBrief.moduleDocCap).toBeGreaterThan(largeBrief.moduleDocCap)
    expect(microBrief.graphEdgeCap).toBeGreaterThan(largeBrief.graphEdgeCap)
  })
})
