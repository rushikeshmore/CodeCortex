import { existsSync } from 'node:fs'
import { cortexPath } from '../utils/files.js'
import { writeModuleDoc } from './modules.js'
import { getModuleDependencies } from './graph.js'
import { summarizeFileList } from '../utils/truncate.js'
import { classifyProject, getSizeLimits } from './project-size.js'
import type { DependencyGraph, SymbolRecord, TemporalData, ModuleAnalysis } from '../types/index.js'

export interface StructuralModuleData {
  graph: DependencyGraph
  symbols: SymbolRecord[]
  temporal: TemporalData | null
}

export async function generateStructuralModuleDocs(
  projectRoot: string,
  data: StructuralModuleData,
): Promise<number> {
  const totalFiles = data.graph.modules.reduce((s, m) => s + m.files.length, 0)
  const totalSymbols = data.symbols.length
  const limits = getSizeLimits(classifyProject(totalFiles, totalSymbols, data.graph.modules.length))
  let generated = 0

  for (const mod of data.graph.modules) {
    // Never overwrite existing (possibly LLM-generated) docs
    const docPath = cortexPath(projectRoot, 'modules', `${mod.name}.md`)
    if (existsSync(docPath)) continue

    // Exported symbols in this module
    const moduleFiles = new Set(mod.files)
    const exported = data.symbols
      .filter(s => moduleFiles.has(s.file) && s.exported)
      .map(s => {
        const loc = s.endLine > s.startLine
          ? `${s.file}:${s.startLine}-${s.endLine}`
          : `${s.file}:${s.startLine}`
        return `${s.name} (${s.kind}, ${loc})`
      })

    // Dependencies
    const deps = getModuleDependencies(data.graph, mod.name)
    const importsFromModules = new Set<string>()
    const importedByModules = new Set<string>()

    for (const edge of deps.imports) {
      for (const other of data.graph.modules) {
        if (other.name !== mod.name && other.files.includes(edge.target)) {
          importsFromModules.add(other.name)
        }
      }
    }
    for (const edge of deps.importedBy) {
      for (const other of data.graph.modules) {
        if (other.name !== mod.name && other.files.includes(edge.source)) {
          importedByModules.add(other.name)
        }
      }
    }

    const depLines: string[] = []
    if (importsFromModules.size > 0) depLines.push(`Imports from: ${[...importsFromModules].join(', ')}`)
    if (importedByModules.size > 0) depLines.push(`Imported by: ${[...importedByModules].join(', ')}`)

    // Temporal signals
    let temporalSignals: ModuleAnalysis['temporalSignals']
    if (data.temporal) {
      const hotspots = data.temporal.hotspots.filter(h => moduleFiles.has(h.file))
      const topHotspot = hotspots[0]

      const couplings = data.temporal.coupling.filter(c =>
        moduleFiles.has(c.fileA) || moduleFiles.has(c.fileB)
      )
      const coupledWith = couplings.map(c => {
        const other = moduleFiles.has(c.fileA) ? c.fileB : c.fileA
        return `${other} (${c.cochanges} co-changes, ${Math.round(c.strength * 100)}%)`
      })

      const bugs = data.temporal.bugHistory.filter(b => moduleFiles.has(b.file))

      temporalSignals = {
        churn: topHotspot ? `${topHotspot.changes} changes (${topHotspot.stability})` : 'no hotspot data',
        coupledWith,
        stability: topHotspot?.stability ?? 'unknown',
        bugHistory: bugs.flatMap(b => b.lessons),
        lastChanged: topHotspot?.lastChanged ?? 'unknown',
      }
    }

    // Group files by type instead of raw list dump
    const fileSummary = summarizeFileList(mod.files)
    const dataFlow = Object.entries(fileSummary.byType)
      .map(([type, { count, sample }]) => {
        const sampleStr = sample.slice(0, limits.moduleFileSampleCap).join(', ')
        return `${type}: ${count} files (${sampleStr}${count > limits.moduleFileSampleCap ? ', ...' : ''})`
      })
      .join('. ') || `${mod.files.length} files`

    const symCap = limits.moduleExportedSymbolCap
    const cappedExported = exported.length > symCap
      ? [...exported.slice(0, symCap), `...and ${exported.length - symCap} more`]
      : exported

    const analysis: ModuleAnalysis = {
      name: mod.name,
      purpose: `${mod.files.length} files, ${mod.lines} lines (${mod.language}). Auto-generated from code structure — use \`analyze_module\` MCP tool for semantic analysis.`,
      dataFlow,
      publicApi: cappedExported,
      gotchas: [],
      dependencies: depLines,
      temporalSignals,
    }

    await writeModuleDoc(projectRoot, analysis)
    generated++
  }

  return generated
}
