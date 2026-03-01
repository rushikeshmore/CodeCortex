import type { DependencyGraph, ImportEdge, CallEdge, ModuleNode } from '../types/index.js'
import { readFile, writeFile, cortexPath } from '../utils/files.js'

export async function readGraph(projectRoot: string): Promise<DependencyGraph | null> {
  const content = await readFile(cortexPath(projectRoot, 'graph.json'))
  if (!content) return null
  return JSON.parse(content) as DependencyGraph
}

export async function writeGraph(projectRoot: string, graph: DependencyGraph): Promise<void> {
  await writeFile(cortexPath(projectRoot, 'graph.json'), JSON.stringify(graph, null, 2))
}

export function buildGraph(opts: {
  modules: ModuleNode[]
  imports: ImportEdge[]
  calls: CallEdge[]
  entryPoints: string[]
  externalDeps: Record<string, string[]>
}): DependencyGraph {
  return {
    generated: new Date().toISOString(),
    modules: opts.modules,
    imports: opts.imports,
    calls: opts.calls,
    entryPoints: opts.entryPoints,
    externalDeps: opts.externalDeps,
  }
}

export function getModuleDependencies(graph: DependencyGraph, moduleName: string): {
  imports: ImportEdge[]
  importedBy: ImportEdge[]
  calls: CallEdge[]
} {
  const moduleFiles = new Set(
    graph.modules.find(m => m.name === moduleName)?.files || []
  )

  return {
    imports: graph.imports.filter(e => moduleFiles.has(e.source)),
    importedBy: graph.imports.filter(e => moduleFiles.has(e.target)),
    calls: graph.calls.filter(e => moduleFiles.has(e.file)),
  }
}

export function getFileImporters(graph: DependencyGraph, file: string): string[] {
  return graph.imports
    .filter(e => e.target.includes(file))
    .map(e => e.source)
}

export function getMostImportedFiles(graph: DependencyGraph, limit: number = 10): { file: string; importCount: number }[] {
  const counts = new Map<string, number>()
  for (const edge of graph.imports) {
    counts.set(edge.target, (counts.get(edge.target) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, importCount]) => ({ file, importCount }))
}

export function enrichCouplingWithImports(
  graph: DependencyGraph,
  coupling: { fileA: string; fileB: string; hasImport: boolean }[]
): void {
  const importPairs = new Set<string>()
  for (const edge of graph.imports) {
    importPairs.add([edge.source, edge.target].sort().join('|'))
  }

  for (const pair of coupling) {
    const key = [pair.fileA, pair.fileB].sort().join('|')
    pair.hasImport = importPairs.has(key)
  }
}
