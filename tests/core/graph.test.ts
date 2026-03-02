import { describe, it, expect } from 'vitest'
import { buildGraph, getModuleDependencies, getMostImportedFiles, enrichCouplingWithImports } from '../../src/core/graph.js'
import type { ModuleNode, ImportEdge, CallEdge, DependencyGraph } from '../../src/types/index.js'

function makeGraph(): DependencyGraph {
  const modules: ModuleNode[] = [
    { path: 'src/core', name: 'core', files: ['src/core/processor.ts', 'src/core/types.ts'], language: 'typescript', lines: 200, symbols: 5 },
    { path: 'src/utils', name: 'utils', files: ['src/utils/format.ts', 'src/utils/config.ts'], language: 'typescript', lines: 100, symbols: 3 },
  ]

  const imports: ImportEdge[] = [
    { source: 'src/core/processor.ts', target: 'src/core/types.ts', specifiers: ['Result'] },
    { source: 'src/utils/format.ts', target: 'src/core/types.ts', specifiers: ['Result'] },
    { source: 'src/core/processor.ts', target: 'src/utils/format.ts', specifiers: ['formatOutput'] },
  ]

  const calls: CallEdge[] = [
    { caller: 'src/core/processor.ts:processData', callee: 'formatOutput', file: 'src/core/processor.ts', line: 15 },
  ]

  return buildGraph({
    modules,
    imports,
    calls,
    entryPoints: ['src/index.ts'],
    externalDeps: { zod: ['src/core/processor.ts'] },
  })
}

describe('buildGraph', () => {
  it('creates a DependencyGraph with all fields', () => {
    const graph = makeGraph()
    expect(graph.generated).toBeDefined()
    expect(graph.modules).toHaveLength(2)
    expect(graph.imports).toHaveLength(3)
    expect(graph.calls).toHaveLength(1)
    expect(graph.entryPoints).toEqual(['src/index.ts'])
    expect(graph.externalDeps).toHaveProperty('zod')
  })
})

describe('getModuleDependencies', () => {
  it('returns imports FROM the module', () => {
    const graph = makeGraph()
    const deps = getModuleDependencies(graph, 'core')

    // core files: processor.ts, types.ts
    // processor imports types (within core) and format (cross-module)
    expect(deps.imports.length).toBeGreaterThanOrEqual(2)
  })

  it('returns imports INTO the module (importedBy)', () => {
    const graph = makeGraph()
    const deps = getModuleDependencies(graph, 'core')

    // types.ts is imported by format.ts (from utils)
    expect(deps.importedBy.length).toBeGreaterThanOrEqual(1)
    expect(deps.importedBy.some(e => e.source === 'src/utils/format.ts')).toBe(true)
  })

  it('returns calls within the module', () => {
    const graph = makeGraph()
    const deps = getModuleDependencies(graph, 'core')

    expect(deps.calls.length).toBeGreaterThanOrEqual(1)
    expect(deps.calls[0]!.callee).toBe('formatOutput')
  })

  it('returns empty for unknown module', () => {
    const graph = makeGraph()
    const deps = getModuleDependencies(graph, 'nonexistent')

    expect(deps.imports).toHaveLength(0)
    expect(deps.importedBy).toHaveLength(0)
    expect(deps.calls).toHaveLength(0)
  })
})

describe('getMostImportedFiles', () => {
  it('ranks files by import count', () => {
    const graph = makeGraph()
    const top = getMostImportedFiles(graph, 5)

    // types.ts is imported by 2 files (processor + format)
    expect(top[0]!.file).toBe('src/core/types.ts')
    expect(top[0]!.importCount).toBe(2)
  })

  it('respects limit', () => {
    const graph = makeGraph()
    const top = getMostImportedFiles(graph, 1)

    expect(top).toHaveLength(1)
  })
})

describe('enrichCouplingWithImports', () => {
  it('sets hasImport=true for coupled files that import each other', () => {
    const graph = makeGraph()
    const coupling = [
      { fileA: 'src/core/processor.ts', fileB: 'src/core/types.ts', cochanges: 5, strength: 0.8, hasImport: false },
      { fileA: 'src/core/processor.ts', fileB: 'src/utils/config.ts', cochanges: 3, strength: 0.5, hasImport: false },
    ]

    enrichCouplingWithImports(graph, coupling)

    // processor imports types → hasImport should be true
    expect(coupling[0]!.hasImport).toBe(true)
    // processor does NOT import config → hasImport should remain false
    expect(coupling[1]!.hasImport).toBe(false)
  })
})
