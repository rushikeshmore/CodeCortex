import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFile, cortexPath } from '../../utils/files.js'
import { readGraph, getModuleDependencies, getMostImportedFiles, getFileImporters } from '../../core/graph.js'
import { readModuleDoc, listModuleDocs } from '../../core/modules.js'
import { listSessions, readSession, getLatestSession } from '../../core/sessions.js'
import { listDecisions, readDecision } from '../../core/decisions.js'
import { searchKnowledge } from '../../core/search.js'
import { computeFreshness } from '../../core/freshness.js'
import { capString, truncateArray } from '../../utils/truncate.js'
import { readManifest } from '../../core/manifest.js'
import { getSizeLimits, type SizeLimits, type DetailLevel } from '../../core/project-size.js'
import type { TemporalData, SymbolIndex, FreshnessInfo } from '../../types/index.js'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

/** Attach freshness metadata to any response object. */
function withFreshness<T extends object>(data: T, freshness: FreshnessInfo | null): T & { _freshness?: FreshnessInfo } {
  if (!freshness) return data
  return { ...data, _freshness: freshness }
}

export function registerReadTools(server: McpServer, projectRoot: string): void {
  // Cache freshness per MCP session to avoid repeated git calls.
  let cachedFreshness: { info: FreshnessInfo | null; timestamp: number } | null = null
  const FRESHNESS_TTL_MS = 60_000

  async function getFreshness(): Promise<FreshnessInfo | null> {
    const now = Date.now()
    if (cachedFreshness && (now - cachedFreshness.timestamp) < FRESHNESS_TTL_MS) {
      return cachedFreshness.info
    }
    const info = await computeFreshness(projectRoot)
    cachedFreshness = { info, timestamp: now }
    return info
  }

  // Cache size-based limits per MCP session (project size doesn't change mid-session).
  let cachedLimits: SizeLimits | null = null

  async function getLimits(detail: DetailLevel = 'brief'): Promise<SizeLimits> {
    // 'full' always returns hard caps — no caching needed
    if (detail === 'full') {
      return getSizeLimits('large', 'full')
    }
    if (cachedLimits) return cachedLimits
    const manifest = await readManifest(projectRoot)
    cachedLimits = getSizeLimits(manifest?.projectSize ?? 'large')
    return cachedLimits
  }

  // --- Tool 1: get_project_overview ---
  server.registerTool(
    'get_project_overview',
    {
      description: 'Get the project overview: constitution (architecture, risk map, available knowledge) and dependency graph summary. This is the starting point for understanding any codebase. Always call this first.',
      inputSchema: {},
    },
    async () => {
      const constitution = await readFile(cortexPath(projectRoot, 'constitution.md'))

      const graph = await readGraph(projectRoot)
      let graphSummary = null
      if (graph) {
        graphSummary = {
          modules: graph.modules.length,
          imports: graph.imports.length,
          entryPoints: graph.entryPoints,
          mostImported: getMostImportedFiles(graph, 5),
        }
      }

      const freshness = await getFreshness()

      return textResult(withFreshness({
        constitution,
        graphSummary,
      }, freshness))
    }
  )

  // --- Tool 2: get_module_context ---
  server.registerTool(
    'get_module_context',
    {
      description: 'Get deep context for a specific module: purpose, data flow, public API, gotchas, dependencies, and temporal signals (churn, coupling, bug history). Use after get_project_overview when you need to work on a specific module.',
      inputSchema: {
        name: z.string().describe('Module name (e.g., "scoring", "api", "indexer")'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data (use only when you need exhaustive info).'),
      },
    },
    async ({ name, detail }) => {
      const limits = await getLimits(detail)
      const doc = await readModuleDoc(projectRoot, name)
      if (!doc) {
        const available = await listModuleDocs(projectRoot)
        return textResult({ found: false, name, available, message: `Module "${name}" not found. Available modules: ${available.join(', ')}` })
      }

      const cappedDoc = capString(doc, limits.moduleDocCap)

      const graph = await readGraph(projectRoot)
      let depSummary = null
      if (graph) {
        const deps = getModuleDependencies(graph, name)

        const importsFrom = new Set<string>()
        const importedBy = new Set<string>()
        const externalDeps = new Set<string>()

        for (const edge of deps.imports) {
          const targetMod = graph.modules.find(m => m.files.includes(edge.target))
          if (targetMod && targetMod.name !== name) importsFrom.add(targetMod.name)
          if (!edge.target.startsWith('.') && !edge.target.startsWith('/')) {
            externalDeps.add(edge.target)
          }
        }
        for (const edge of deps.importedBy) {
          const sourceMod = graph.modules.find(m => m.files.includes(edge.source))
          if (sourceMod && sourceMod.name !== name) importedBy.add(sourceMod.name)
        }

        const modFiles = new Set(graph.modules.find(m => m.name === name)?.files ?? [])
        for (const [pkg, files] of Object.entries(graph.externalDeps)) {
          if (files.some(f => modFiles.has(f))) externalDeps.add(pkg)
        }

        const extDepsArr = [...externalDeps]
        const importsFromArr = [...importsFrom]
        const importedByArr = [...importedBy]
        depSummary = {
          importsFrom: importsFromArr.slice(0, limits.depModuleNameCap),
          importedBy: importedByArr.slice(0, limits.depModuleNameCap),
          totalImportsFrom: importsFromArr.length,
          totalImportedBy: importedByArr.length,
          externalDeps: extDepsArr.slice(0, limits.depExternalCap),
          totalExternalDeps: extDepsArr.length,
        }
      }

      const freshness = await getFreshness()

      return textResult(withFreshness({ found: true, name, doc: cappedDoc, dependencies: depSummary }, freshness))
    }
  )

  // --- Tool 3: get_session_briefing ---
  server.registerTool(
    'get_session_briefing',
    {
      description: 'Get a briefing of what changed since the last session. Shows files changed, modules affected, and decisions recorded. Use at the start of a new session to catch up.',
      inputSchema: {},
    },
    async () => {
      const latestId = await getLatestSession(projectRoot)
      if (!latestId) {
        return textResult({ hasSession: false, message: 'No previous sessions recorded.' })
      }

      const session = await readSession(projectRoot, latestId)
      const allSessions = await listSessions(projectRoot)
      const freshness = await getFreshness()

      return textResult(withFreshness({
        hasSession: true,
        latest: session,
        totalSessions: allSessions.length,
        recentSessionIds: allSessions.slice(0, (await getLimits()).sessionsCap),
      }, freshness))
    }
  )

  // --- Tool 4: search_knowledge ---
  server.registerTool(
    'search_knowledge',
    {
      description: 'Search across symbols (functions, classes, types), file paths, and knowledge docs. Returns ranked results: symbol definitions first, then file paths, then doc matches. Use instead of grep for finding code concepts.',
      inputSchema: {
        query: z.string().describe('Search term or phrase (e.g., "auth", "processData", "gateway")'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results to return. Defaults to size-adaptive limit.'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns more results.'),
      },
    },
    async ({ query, limit, detail }) => {
      const limits = await getLimits(detail)
      const effectiveLimit = limit ?? limits.searchDefaultLimit
      const results = await searchKnowledge(projectRoot, query, effectiveLimit)
      const freshness = await getFreshness()

      return textResult(withFreshness({
        query,
        totalResults: results.length,
        results,
      }, freshness))
    }
  )

  // --- Tool 5: get_decision_history ---
  server.registerTool(
    'get_decision_history',
    {
      description: 'Get architectural decision records. Shows WHY the codebase is built the way it is. Filter by topic keyword.',
      inputSchema: {
        topic: z.string().optional().describe('Optional keyword to filter decisions'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data.'),
      },
    },
    async ({ topic, detail }) => {
      const limits = await getLimits(detail)
      const ids = await listDecisions(projectRoot)
      const decisions: string[] = []

      for (const id of ids) {
        const content = await readDecision(projectRoot, id)
        if (content) {
          if (!topic || content.toLowerCase().includes(topic.toLowerCase())) {
            decisions.push(capString(content, limits.decisionCharCap))
          }
        }
      }

      const capped = truncateArray(decisions, limits.decisionCap, 'decisions')
      const freshness = await getFreshness()

      return textResult(withFreshness({
        total: capped.total,
        topic: topic || 'all',
        decisions: capped.items,
        ...(capped.truncated ? { truncated: capped.message } : {}),
      }, freshness))
    }
  )

  // --- Tool 6: get_dependency_graph ---
  server.registerTool(
    'get_dependency_graph',
    {
      description: 'Get the import/export dependency graph. Without filters, returns a summary dashboard. With a file or module filter, returns scoped edges (capped at 50). Use `name` for module filtering.',
      inputSchema: {
        file: z.string().optional().describe('Filter to edges involving this file path'),
        name: z.string().optional().describe('Filter to edges involving this module name'),
        module: z.string().optional().describe('(Deprecated — use `name`) Alias for name'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data.'),
      },
    },
    async ({ file, name, module, detail }) => {
      const graph = await readGraph(projectRoot)
      if (!graph) return textResult({ found: false, message: 'No graph data. Run codecortex init first.' })

      const freshness = await getFreshness()
      const mod = name || module

      const limits = await getLimits(detail)

      if (mod) {
        const deps = getModuleDependencies(graph, mod)
        return textResult(withFreshness({
          module: mod,
          imports: deps.imports.slice(0, limits.graphEdgeCap),
          importedBy: deps.importedBy.slice(0, limits.graphEdgeCap),
          calls: deps.calls.slice(0, limits.graphCallCap),
          totalImports: deps.imports.length,
          totalImportedBy: deps.importedBy.length,
          totalCalls: deps.calls.length,
        }, freshness))
      }

      if (file) {
        const imports = graph.imports.filter(e => e.source.includes(file) || e.target.includes(file))
        const calls = graph.calls.filter(e => e.file.includes(file))
        return textResult(withFreshness({
          file,
          imports: imports.slice(0, limits.graphFileEdgeCap),
          calls: calls.slice(0, limits.graphFileEdgeCap),
          totalImports: imports.length,
          totalCalls: calls.length,
        }, freshness))
      }

      // No filter — return summary dashboard (never dump raw graph)
      return textResult(withFreshness({
        summary: true,
        modules: graph.modules.length,
        imports: graph.imports.length,
        calls: graph.calls.length,
        entryPoints: graph.entryPoints,
        externalDeps: Object.keys(graph.externalDeps),
        topImported: getMostImportedFiles(graph, 10),
      }, freshness))
    }
  )

  // --- Tool 7: lookup_symbol ---
  server.registerTool(
    'lookup_symbol',
    {
      description: 'Look up a symbol (function, class, type, interface, const) by name. Returns file path, line numbers, signature, and whether it\'s exported. Use to find where something is defined.',
      inputSchema: {
        name: z.string().describe('Symbol name to search for'),
        kind: z.enum(['function', 'class', 'interface', 'type', 'const', 'enum', 'method', 'property', 'variable']).optional().describe('Filter by symbol kind'),
        file: z.string().optional().describe('Filter by file path (partial match)'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data.'),
      },
    },
    async ({ name, kind, file, detail }) => {
      const content = await readFile(cortexPath(projectRoot, 'symbols.json'))
      if (!content) return textResult({ found: false, message: 'No symbol index. Run codecortex init first.' })

      const index: SymbolIndex = JSON.parse(content)
      let matches = index.symbols.filter(s =>
        s.name.toLowerCase().includes(name.toLowerCase())
      )

      if (kind) matches = matches.filter(s => s.kind === kind)
      if (file) matches = matches.filter(s => s.file.includes(file))

      const freshness = await getFreshness()

      return textResult(withFreshness({
        query: { name, kind, file },
        totalMatches: matches.length,
        symbols: matches.slice(0, (await getLimits(detail)).symbolMatchCap),
      }, freshness))
    }
  )

  // --- Tool 8: get_change_coupling ---
  server.registerTool(
    'get_change_coupling',
    {
      description: 'CRITICAL: Call this BEFORE editing any file. Shows files that historically change together. If file A is coupled with file B, editing A without B will likely cause a bug. Hidden couplings (no import between files) are especially dangerous.',
      inputSchema: {
        file: z.string().optional().describe('Show coupling for this specific file'),
        minStrength: z.number().min(0).max(1).default(0.3).describe('Minimum coupling strength (0-1). Default 0.3.'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data.'),
      },
    },
    async ({ file, minStrength, detail }) => {
      const content = await readFile(cortexPath(projectRoot, 'temporal.json'))
      if (!content) return textResult({ found: false, message: 'No temporal data. Run codecortex init first.' })

      const temporal: TemporalData = JSON.parse(content)
      let coupling = temporal.coupling.filter(c => c.strength >= minStrength)

      if (file) {
        coupling = coupling.filter(c =>
          c.fileA.includes(file) || c.fileB.includes(file)
        )
      }

      const limits = await getLimits(detail)
      const capped = truncateArray(coupling, limits.couplingCap, 'coupling pairs')
      const freshness = await getFreshness()

      return textResult(withFreshness({
        file: file || 'all',
        minStrength,
        total: capped.total,
        couplings: capped.items,
        ...(capped.truncated ? { truncated: capped.message } : {}),
        warning: coupling.filter(c => !c.hasImport).length > 0
          ? 'HIDDEN DEPENDENCIES FOUND — some coupled files have NO import between them'
          : null,
      }, freshness))
    }
  )

  // --- Tool 9: get_hotspots ---
  server.registerTool(
    'get_hotspots',
    {
      description: 'Get files ranked by risk: change frequency (churn), coupling count, and bug history. Volatile files with many couplings need extra care when editing.',
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10).describe('Number of files to return'),
      },
    },
    async ({ limit }) => {
      const content = await readFile(cortexPath(projectRoot, 'temporal.json'))
      if (!content) return textResult({ found: false, message: 'No temporal data. Run codecortex init first.' })

      const temporal: TemporalData = JSON.parse(content)

      // Calculate risk score: churn + coupling count + bug count
      const riskMap = new Map<string, { churn: number; couplings: number; bugs: number; risk: number }>()

      for (const h of temporal.hotspots) {
        riskMap.set(h.file, { churn: h.changes, couplings: 0, bugs: 0, risk: h.changes })
      }

      for (const c of temporal.coupling) {
        for (const f of [c.fileA, c.fileB]) {
          const entry = riskMap.get(f) || { churn: 0, couplings: 0, bugs: 0, risk: 0 }
          entry.couplings++
          entry.risk += c.strength * 2
          riskMap.set(f, entry)
        }
      }

      for (const b of temporal.bugHistory) {
        const entry = riskMap.get(b.file) || { churn: 0, couplings: 0, bugs: 0, risk: 0 }
        entry.bugs = b.fixCommits
        entry.risk += b.fixCommits * 3
        riskMap.set(b.file, entry)
      }

      const ranked = [...riskMap.entries()]
        .sort((a, b) => b[1].risk - a[1].risk)
        .slice(0, limit)
        .map(([file, data]) => ({ file, ...data, risk: Math.round(data.risk * 100) / 100 }))

      const freshness = await getFreshness()

      return textResult(withFreshness({
        period: `${temporal.periodDays} days`,
        totalCommits: temporal.totalCommits,
        hotspots: ranked,
      }, freshness))
    }
  )

  // --- Tool 10: get_edit_briefing ---
  server.registerTool(
    'get_edit_briefing',
    {
      description: 'CALL THIS BEFORE EDITING FILES. Takes a list of files you plan to edit and returns everything you need to know: co-change warnings (files you must also update), risk assessment, who imports these files, relevant patterns, and recent change history. Prevents bugs from hidden dependencies.',
      inputSchema: {
        files: z.array(z.string()).min(1).describe('File paths you plan to edit (relative to project root)'),
        detail: z.enum(['brief', 'full']).default('brief').describe('Response detail level. "brief" (default) uses size-adaptive caps. "full" returns complete data.'),
      },
    },
    async ({ files, detail }) => {
      const temporalContent = await readFile(cortexPath(projectRoot, 'temporal.json'))
      if (!temporalContent) return textResult({ found: false, message: 'No temporal data. Run codecortex init first.' })

      const limits = await getLimits(detail)
      const temporal: TemporalData = JSON.parse(temporalContent)
      const graph = await readGraph(projectRoot)
      const patternsContent = await readFile(cortexPath(projectRoot, 'patterns.md'))

      const briefings = files.map(file => {
        // 1. Co-change warnings
        const couplings = temporal.coupling
          .filter(c => c.fileA.includes(file) || c.fileB.includes(file))
          .map(c => {
            const other = c.fileA.includes(file) ? c.fileB : c.fileA
            return {
              file: other,
              cochanges: c.cochanges,
              strength: c.strength,
              hasImport: c.hasImport,
              warning: c.warning || null,
            }
          })
          .sort((a, b) => b.strength - a.strength)

        // 2. Risk assessment
        const hotspot = temporal.hotspots.find(h => h.file.includes(file))
        const bugs = temporal.bugHistory.find(b => b.file.includes(file))
        const couplingCount = couplings.length
        const hiddenDeps = couplings.filter(c => !c.hasImport).length

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
        const riskScore = (hotspot?.changes || 0) + (couplingCount * 2) + ((bugs?.fixCommits || 0) * 3) + (hiddenDeps * 4)

        if (riskScore >= 20) riskLevel = 'CRITICAL'
        else if (riskScore >= 12) riskLevel = 'HIGH'
        else if (riskScore >= 6) riskLevel = 'MEDIUM'

        // 3. Who imports this file (capped)
        let importedBy: string[] = []
        if (graph) {
          importedBy = getFileImporters(graph, file).slice(0, limits.importersCap)
        }

        // 4. Recent changes
        const recentChange = hotspot ? {
          lastChanged: hotspot.lastChanged,
          daysSinceChange: hotspot.daysSinceChange,
          totalChanges: hotspot.changes,
          stability: hotspot.stability,
        } : null

        // 5. Bug history
        const bugHistory = bugs ? {
          fixCommits: bugs.fixCommits,
          lessons: bugs.lessons,
        } : null

        return {
          file,
          risk: {
            level: riskLevel,
            score: Math.round(riskScore * 100) / 100,
            reason: buildRiskReason(riskLevel, hotspot, couplingCount, hiddenDeps, bugs),
          },
          cochangeWarnings: couplings,
          importedBy,
          recentChange,
          bugHistory,
        }
      })

      // Files you should also consider editing (coupled but not in the input list)
      const inputSet = new Set(files)
      const alsoConsider = new Set<string>()
      for (const b of briefings) {
        for (const c of b.cochangeWarnings) {
          // Check if coupled file is NOT in the files being edited
          const coupledFile = c.file
          const isInInput = files.some(f => coupledFile.includes(f) || f.includes(coupledFile))
          if (!isInInput && c.strength >= 0.5) {
            alsoConsider.add(`${coupledFile} (${Math.round(c.strength * 100)}% co-change with ${b.file}${c.hasImport ? '' : ', NO import — hidden dep'})`)
          }
        }
      }

      const freshness = await getFreshness()

      return textResult(withFreshness({
        briefings,
        alsoConsiderEditing: [...alsoConsider],
        patterns: patternsContent || null,
      }, freshness))
    }
  )
}

function buildRiskReason(
  level: string,
  hotspot: { changes: number; stability: string } | undefined,
  couplings: number,
  hiddenDeps: number,
  bugs: { fixCommits: number } | undefined,
): string {
  if (level === 'LOW') return 'Low change frequency, few couplings.'
  const parts: string[] = []
  if (hotspot && hotspot.changes >= 5) parts.push(`${hotspot.changes} changes (${hotspot.stability})`)
  if (couplings > 0) parts.push(`${couplings} coupled file${couplings === 1 ? '' : 's'}`)
  if (hiddenDeps > 0) parts.push(`${hiddenDeps} hidden dep${hiddenDeps === 1 ? '' : 's'}`)
  if (bugs && bugs.fixCommits > 0) parts.push(`${bugs.fixCommits} bug-fix commit${bugs.fixCommits === 1 ? '' : 's'}`)
  return parts.join(', ') + '.'
}
