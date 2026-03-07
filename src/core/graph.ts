import type { DependencyGraph, ImportEdge, CallEdge, ModuleNode, ChangeCoupling } from '../types/index.js'
import { readFile, writeFile, ensureDir, cortexPath } from '../utils/files.js'
import { createWriteStream } from 'node:fs'
import { dirname } from 'node:path'

export async function readGraph(projectRoot: string): Promise<DependencyGraph | null> {
  const content = await readFile(cortexPath(projectRoot, 'graph.json'))
  if (!content) return null
  return JSON.parse(content) as DependencyGraph
}

export async function writeGraph(projectRoot: string, graph: DependencyGraph): Promise<void> {
  const path = cortexPath(projectRoot, 'graph.json')
  await ensureDir(dirname(path))
  const stream = createWriteStream(path)
  stream.setMaxListeners(0)

  function waitDrain(): Promise<void> {
    return new Promise((resolve) => stream.once('drain', resolve))
  }

  async function writeArray(arr: unknown[]): Promise<void> {
    stream.write('[')
    const BATCH = 1000
    for (let i = 0; i < arr.length; i += BATCH) {
      const end = Math.min(i + BATCH, arr.length)
      const chunks: string[] = []
      for (let j = i; j < end; j++) {
        chunks.push((j > 0 ? ',' : '') + JSON.stringify(arr[j]))
      }
      if (!stream.write(chunks.join(''))) await waitDrain()
    }
    stream.write(']')
  }

  // Write scalar fields
  stream.write(`{"generated":${JSON.stringify(graph.generated)},"modules":`)
  await writeArray(graph.modules)
  stream.write(',"imports":')
  await writeArray(graph.imports)
  stream.write(',"calls":')
  await writeArray(graph.calls)
  stream.write(`,"entryPoints":${JSON.stringify(graph.entryPoints)}`)
  stream.write(`,"externalDeps":${JSON.stringify(graph.externalDeps)}`)
  stream.write('}')

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
    stream.end()
  })
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
  coupling: ChangeCoupling[]
): void {
  const importPairs = new Set<string>()
  for (const edge of graph.imports) {
    importPairs.add([edge.source, edge.target].sort().join('|'))
  }

  for (const pair of coupling) {
    const key = [pair.fileA, pair.fileB].sort().join('|')
    pair.hasImport = importPairs.has(key)
    if (pair.strength >= 0.7 && !pair.hasImport) {
      pair.warning = `HIDDEN DEPENDENCY — ${Math.round(pair.strength * 100)}% co-change rate`
    }
  }
}
