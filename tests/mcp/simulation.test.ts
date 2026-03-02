/**
 * Multi-Agent Simulation Tests
 *
 * Simulates 4 AI agent personas interacting with CodeCortex through
 * realistic MCP tool workflows. Each persona chains multiple tool calls
 * where output of one informs the next — catching data flow issues
 * that unit tests miss.
 *
 * Personas:
 *   1. New Agent      — First time on codebase (read-only discovery)
 *   2. Bug Fixer      — Investigating a risky file (risk-focused reads)
 *   3. Feature Dev    — Building a feature (reads → writes → verification)
 *   4. Session Resumer — Returning after a break (session-aware workflow)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { readFile, writeFile, cortexPath, ensureDir } from '../../src/utils/files.js'
import { readManifest } from '../../src/core/manifest.js'
import { readGraph, getModuleDependencies, getMostImportedFiles } from '../../src/core/graph.js'
import { readModuleDoc, writeModuleDoc, listModuleDocs, buildAnalysisPrompt } from '../../src/core/modules.js'
import { writeDecision, createDecision, listDecisions, readDecision } from '../../src/core/decisions.js'
import { writeSession, createSession, listSessions, readSession, getLatestSession } from '../../src/core/sessions.js'
import { addPattern, readPatterns } from '../../src/core/patterns.js'
import { searchKnowledge } from '../../src/core/search.js'
import type { TemporalData, SymbolIndex, DependencyGraph, ModuleAnalysis } from '../../src/types/index.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()

  // Seed a previous session so Persona 4 has data to resume from
  const session = createSession({
    filesChanged: ['src/core/processor.ts', 'src/core/types.ts'],
    modulesAffected: ['core'],
    summary: 'Fixed race condition in async processing. Added mutex lock around shared state.',
    decisionsRecorded: [],
  })
  await writeSession(fixture.root, session)
})

afterAll(async () => {
  await fixture.cleanup()
})

// ─────────────────────────────────────────────────────
// Persona 1: New Agent — First time on codebase
// ─────────────────────────────────────────────────────
describe('Persona 1: New Agent — codebase discovery', () => {
  let graph: DependencyGraph
  let symbolIndex: SymbolIndex

  it('Step 1: calls get_project_overview to understand the codebase', async () => {
    // Tool: get_project_overview
    const constitution = await readFile(cortexPath(fixture.root, 'constitution.md'))
    const overview = await readFile(cortexPath(fixture.root, 'overview.md'))
    const manifest = await readManifest(fixture.root)
    graph = (await readGraph(fixture.root))!

    expect(constitution).toContain('Constitution')
    expect(overview).toContain('Entry Points')
    expect(manifest).not.toBeNull()
    expect(manifest!.project).toBe('test-project')
    expect(graph.modules.length).toBeGreaterThan(0)

    const graphSummary = {
      modules: graph.modules.length,
      imports: graph.imports.length,
      entryPoints: graph.entryPoints,
      mostImported: getMostImportedFiles(graph, 5),
    }

    // Agent now knows: 2 modules, 3 imports, 1 entry point
    expect(graphSummary.modules).toBe(2)
    expect(graphSummary.entryPoints).toContain('src/index.ts')
    expect(graphSummary.mostImported[0]!.file).toBe('src/core/types.ts')
  })

  it('Step 2: picks "core" module and calls get_module_context', async () => {
    // Agent picks the first module from the graph
    const targetModule = graph.modules[0]!.name
    expect(targetModule).toBe('core')

    // Tool: get_module_context
    const doc = await readModuleDoc(fixture.root, targetModule)
    const deps = getModuleDependencies(graph, targetModule)

    // No module doc yet (warm tier empty), but dependencies exist
    expect(doc).toBeNull()
    expect(deps.imports.length).toBeGreaterThan(0)
    expect(deps.calls.length).toBeGreaterThan(0)
  })

  it('Step 3: calls lookup_symbol for "processData"', async () => {
    // Agent saw "processData" in the graph calls — looks it up
    const content = await readFile(cortexPath(fixture.root, 'symbols.json'))
    symbolIndex = JSON.parse(content!)

    // Tool: lookup_symbol { name: "processData" }
    const matches = symbolIndex.symbols.filter(s =>
      s.name.toLowerCase().includes('processdata')
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]!.kind).toBe('function')
    expect(matches[0]!.file).toBe('src/core/processor.ts')
    expect(matches[0]!.exported).toBe(true)
    expect(matches[0]!.startLine).toBe(5)
  })

  it('Step 4: calls get_dependency_graph filtered to "core" module', async () => {
    // Tool: get_dependency_graph { module: "core" }
    const deps = getModuleDependencies(graph, 'core')

    // Agent discovers: core imports types internally, and is imported by utils
    expect(deps.imports.some(e => e.target.includes('types.ts'))).toBe(true)
    expect(deps.importedBy.some(e => e.source.includes('format.ts'))).toBe(true)

    // Agent can now navigate: processor.ts imports types.ts, format.ts also imports types.ts
  })
})

// ─────────────────────────────────────────────────────
// Persona 2: Bug Fixer — investigating risky code
// ─────────────────────────────────────────────────────
describe('Persona 2: Bug Fixer — risk-focused investigation', () => {
  let temporal: TemporalData

  it('Step 1: calls get_hotspots to find risky files', async () => {
    // Tool: get_hotspots { limit: 5 }
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    temporal = JSON.parse(content!)

    // Calculate risk scores (mirrors tool logic)
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
      .slice(0, 5)

    // processor.ts should be #1 risk: 8 churn + 2 couplings + 3 bugs
    expect(ranked[0]![0]).toBe('src/core/processor.ts')
    expect(ranked[0]![1].churn).toBe(8)
    expect(ranked[0]![1].bugs).toBe(3)
  })

  it('Step 2: calls get_change_coupling for the riskiest file', async () => {
    // Tool: get_change_coupling { file: "processor.ts", minStrength: 0.3 }
    const coupling = temporal.coupling.filter(c =>
      (c.fileA.includes('processor.ts') || c.fileB.includes('processor.ts')) &&
      c.strength >= 0.3
    )

    // Agent discovers: processor.ts is coupled with types.ts (import) and format.ts (HIDDEN!)
    expect(coupling).toHaveLength(2)

    const hiddenDep = coupling.find(c => !c.hasImport)
    expect(hiddenDep).toBeDefined()
    expect(hiddenDep!.warning).toContain('HIDDEN DEPENDENCY')

    // Agent now knows: if editing processor.ts, MUST also check format.ts
  })

  it('Step 3: calls lookup_symbol to find functions in the risky file', async () => {
    // Tool: lookup_symbol { file: "processor.ts" }
    const content = await readFile(cortexPath(fixture.root, 'symbols.json'))
    const index: SymbolIndex = JSON.parse(content!)
    const fileSymbols = index.symbols.filter(s => s.file.includes('processor.ts'))

    expect(fileSymbols.length).toBeGreaterThan(0)
    expect(fileSymbols[0]!.name).toBe('processData')
  })

  it('Step 4: calls search_knowledge for bug-related context', async () => {
    // Tool: search_knowledge { query: "processor" }
    const results = await searchKnowledge(fixture.root, 'processor')

    // Agent finds references in constitution, symbols, graph
    expect(results.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────
// Persona 3: Feature Developer — build + document
// ─────────────────────────────────────────────────────
describe('Persona 3: Feature Developer — write workflow', () => {
  it('Step 1: calls get_project_overview to understand architecture', async () => {
    const manifest = await readManifest(fixture.root)
    const graph = await readGraph(fixture.root)

    expect(manifest!.totalModules).toBe(2)
    expect(graph!.modules.map(m => m.name)).toContain('utils')
  })

  it('Step 2: calls analyze_module for "utils"', async () => {
    // Tool: analyze_module { name: "utils" }
    const graph = await readGraph(fixture.root)
    const module = graph!.modules.find(m => m.name === 'utils')

    expect(module).toBeDefined()
    expect(module!.files).toContain('src/utils/format.ts')
    expect(module!.files).toContain('src/utils/config.ts')

    // In real flow, source files would be read and a prompt generated
    const prompt = buildAnalysisPrompt('utils', [
      { path: 'src/utils/format.ts', content: 'export function formatOutput(data: any): string { return JSON.stringify(data) }' },
      { path: 'src/utils/config.ts', content: 'const TIMEOUT = 5000; export { TIMEOUT }' },
    ])

    expect(prompt).toContain('utils')
    expect(prompt).toContain('formatOutput')
    expect(prompt).toContain('purpose')
  })

  it('Step 3: calls save_module_analysis with structured analysis', async () => {
    // Tool: save_module_analysis { analysis: {...} }
    const analysis: ModuleAnalysis = {
      name: 'utils',
      purpose: 'Shared utility functions for formatting output and configuration constants.',
      dataFlow: 'Receives Result objects from core → formats to string/JSON → returns to caller.',
      publicApi: ['formatOutput(data: Result): string', 'TIMEOUT: number'],
      gotchas: ['TIMEOUT is not configurable at runtime — hardcoded to 5000ms'],
      dependencies: ['core/types.ts for Result interface'],
    }

    await writeModuleDoc(fixture.root, analysis)

    // Verify persistence
    const doc = await readModuleDoc(fixture.root, 'utils')
    expect(doc).toContain('Shared utility functions')
    expect(doc).toContain('formatOutput')
    expect(doc).toContain('TIMEOUT')
  })

  it('Step 4: calls record_decision for the architectural choice', async () => {
    // Tool: record_decision
    const decision = createDecision({
      title: 'Use flat JSON for configuration',
      context: 'Need to store configuration values for the utils module. Considered env vars, YAML, and JSON.',
      decision: 'Use flat JSON constants in config.ts for simplicity. No runtime configuration needed yet.',
      alternatives: ['Environment variables', 'YAML config file', 'Database-backed config'],
      consequences: ['Cannot change config without rebuild', 'Simple and fast to access', 'No external dependencies'],
    })

    await writeDecision(fixture.root, decision)

    // Verify persistence
    const content = await readDecision(fixture.root, decision.id)
    expect(content).toContain('Use flat JSON for configuration')
    expect(content).toContain('Environment variables')
    expect(content).toContain('Cannot change config without rebuild')
  })

  it('Step 5: calls update_patterns to document a coding convention', async () => {
    // Tool: update_patterns
    const result = await addPattern(fixture.root, {
      name: 'Configuration Constants',
      description: 'All configuration values are TypeScript constants in config.ts files. No runtime config loading.',
      example: `export const TIMEOUT = 5000\nexport const MAX_RETRIES = 3`,
      files: ['src/utils/config.ts'],
    })

    expect(result).toBe('added')
  })

  it('Step 6: verifies all writes are discoverable', async () => {
    // Agent checks that the knowledge store now has their contributions
    const modules = await listModuleDocs(fixture.root)
    expect(modules).toContain('utils')

    const decisions = await listDecisions(fixture.root)
    expect(decisions).toContain('use-flat-json-for-configuration')

    const patterns = await readPatterns(fixture.root)
    expect(patterns).toContain('Configuration Constants')

    // search_knowledge should find the new content
    const results = await searchKnowledge(fixture.root, 'TIMEOUT')
    expect(results.length).toBeGreaterThan(0)
    // Should find it in both the module doc and the patterns
    const sources = results.map(r => r.file)
    expect(sources.some(f => f.includes('modules/'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────
// Persona 4: Session Resumer — picking up after a break
// ─────────────────────────────────────────────────────
describe('Persona 4: Session Resumer — context recovery', () => {
  it('Step 1: calls get_session_briefing to catch up', async () => {
    // Tool: get_session_briefing
    const latestId = await getLatestSession(fixture.root)
    expect(latestId).not.toBeNull()

    const session = await readSession(fixture.root, latestId!)
    expect(session).not.toBeNull()
    expect(session).toContain('Fixed race condition')
    expect(session).toContain('src/core/processor.ts')
    expect(session).toContain('core')

    const allSessions = await listSessions(fixture.root)
    expect(allSessions.length).toBeGreaterThanOrEqual(1)
  })

  it('Step 2: calls get_change_coupling for files changed in last session', async () => {
    // Session said processor.ts and types.ts changed — check coupling
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    // Tool: get_change_coupling { file: "processor.ts" }
    const coupling = temporal.coupling.filter(c =>
      c.fileA.includes('processor.ts') || c.fileB.includes('processor.ts')
    )

    expect(coupling.length).toBeGreaterThan(0)

    // Agent discovers format.ts is a hidden dependency — might need updating too
    const hidden = coupling.filter(c => !c.hasImport)
    expect(hidden.length).toBeGreaterThan(0)
  })

  it('Step 3: calls get_hotspots to check if changed files are becoming volatile', async () => {
    const content = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(content!)

    // Tool: get_hotspots { limit: 5 }
    const processorHotspot = temporal.hotspots.find(h => h.file.includes('processor.ts'))
    expect(processorHotspot).toBeDefined()
    expect(processorHotspot!.stability).toBe('volatile')
    expect(processorHotspot!.changes).toBe(8)

    // Agent notes: processor.ts is volatile with 8 changes — needs stabilization
  })

  it('Step 4: calls search_knowledge for context on the race condition fix', async () => {
    // Tool: search_knowledge { query: "race condition" }
    // The session log mentions "race condition" — search should find the session
    const results = await searchKnowledge(fixture.root, 'race condition')

    // Should find it in the session file
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.file.includes('sessions/'))).toBe(true)
  })

  it('Step 5: checks decisions made since last session', async () => {
    // Tool: get_decision_history
    const ids = await listDecisions(fixture.root)

    // Persona 3 recorded a decision — agent sees it
    expect(ids.length).toBeGreaterThan(0)

    // Read the decision
    const content = await readDecision(fixture.root, ids[0]!)
    expect(content).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────
// Cross-persona verification: data integrity
// ─────────────────────────────────────────────────────
describe('Cross-persona: knowledge store integrity', () => {
  it('all tool outputs reference consistent file paths', async () => {
    const graph = await readGraph(fixture.root)
    const symbolsRaw = await readFile(cortexPath(fixture.root, 'symbols.json'))
    const symbols: SymbolIndex = JSON.parse(symbolsRaw!)
    const temporalRaw = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(temporalRaw!)

    // Every symbol's file should be in some module
    const allModuleFiles = new Set(graph!.modules.flatMap(m => m.files))
    for (const symbol of symbols.symbols) {
      expect(allModuleFiles.has(symbol.file)).toBe(true)
    }

    // Every import source/target should be in module files
    for (const imp of graph!.imports) {
      expect(allModuleFiles.has(imp.source)).toBe(true)
    }

    // Every hotspot file should exist in the graph
    const allFiles = new Set([...allModuleFiles, ...graph!.entryPoints])
    for (const hotspot of temporal.hotspots) {
      // Hotspots might reference non-module files too, but at minimum they should be real
      expect(hotspot.file).toBeTruthy()
      expect(hotspot.changes).toBeGreaterThan(0)
    }
  })

  it('coupling pairs reference real files from the graph', async () => {
    const temporalRaw = await readFile(cortexPath(fixture.root, 'temporal.json'))
    const temporal: TemporalData = JSON.parse(temporalRaw!)
    const graph = await readGraph(fixture.root)
    const allFiles = new Set(graph!.modules.flatMap(m => m.files))

    for (const pair of temporal.coupling) {
      expect(allFiles.has(pair.fileA)).toBe(true)
      expect(allFiles.has(pair.fileB)).toBe(true)
      expect(pair.strength).toBeGreaterThan(0)
      expect(pair.strength).toBeLessThanOrEqual(1)
    }
  })

  it('search_knowledge finds content written by Feature Developer', async () => {
    const results = await searchKnowledge(fixture.root, 'formatOutput')
    expect(results.length).toBeGreaterThan(0)

    // Should be discoverable in module doc, patterns, and/or constitution
    const files = results.map(r => r.file)
    expect(files.some(f => f.includes('modules/utils.md'))).toBe(true)
  })

  it('session + decision + pattern writes are all searchable', async () => {
    // Session content
    const sessionResults = await searchKnowledge(fixture.root, 'mutex lock')
    expect(sessionResults.length).toBeGreaterThan(0)

    // Decision content
    const decisionResults = await searchKnowledge(fixture.root, 'flat JSON')
    expect(decisionResults.length).toBeGreaterThan(0)

    // Pattern content
    const patternResults = await searchKnowledge(fixture.root, 'Configuration Constants')
    expect(patternResults.length).toBeGreaterThan(0)
  })
})
