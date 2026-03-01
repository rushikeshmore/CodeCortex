// ─── Symbol (from tree-sitter extraction) ───

export interface SymbolRecord {
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum' | 'method' | 'property' | 'variable'
  file: string
  startLine: number
  endLine: number
  signature?: string
  exported: boolean
  parentName?: string
}

export interface SymbolIndex {
  generated: string
  total: number
  symbols: SymbolRecord[]
}

// ─── Import Edge (from tree-sitter extraction) ───

export interface ImportEdge {
  source: string      // importing file
  target: string      // imported file (resolved relative path)
  specifiers: string[] // what's imported (names or '*')
}

// ─── Call Edge (from tree-sitter extraction) ───

export interface CallEdge {
  caller: string      // file:functionName
  callee: string      // function name being called
  file: string
  line: number
}

// ─── Graph ───

export interface ModuleNode {
  path: string
  name: string
  files: string[]
  language: string
  lines: number
  symbols: number
}

export interface DependencyGraph {
  generated: string
  modules: ModuleNode[]
  imports: ImportEdge[]
  calls: CallEdge[]
  entryPoints: string[]
  externalDeps: Record<string, string[]> // package → files that import it
}

// ─── Temporal ───

export interface ChangeCoupling {
  fileA: string
  fileB: string
  cochanges: number
  strength: number       // cochanges / max(changesA, changesB)
  hasImport: boolean
  warning?: string
}

export interface Hotspot {
  file: string
  changes: number
  stability: 'volatile' | 'stabilizing' | 'moderate' | 'stable' | 'very_stable'
  lastChanged: string   // ISO date
  daysSinceChange: number
}

export interface BugRecord {
  file: string
  fixCommits: number
  lessons: string[]
}

export interface TemporalData {
  generated: string
  periodDays: number
  totalCommits: number
  hotspots: Hotspot[]
  coupling: ChangeCoupling[]
  bugHistory: BugRecord[]
}

// ─── Module Analysis (from LLM) ───

export interface ModuleAnalysis {
  name: string
  purpose: string
  dataFlow: string
  publicApi: string[]
  gotchas: string[]
  dependencies: string[]
  temporalSignals?: {
    churn: string
    coupledWith: string[]
    stability: string
    bugHistory: string[]
    lastChanged: string
  }
}

// ─── Decision Record ───

export interface DecisionRecord {
  id: string
  date: string
  title: string
  context: string
  decision: string
  alternatives: string[]
  consequences: string[]
  status: 'accepted' | 'deprecated' | 'superseded'
}

// ─── Session Log ───

export interface SessionLog {
  id: string
  date: string
  previousSession?: string
  filesChanged: string[]
  modulesAffected: string[]
  decisionsRecorded: string[]
  summary: string
}

// ─── Manifest (cortex.yaml) ───

export interface CortexManifest {
  version: string
  project: string
  root: string
  generated: string
  lastUpdated: string
  languages: string[]
  totalFiles: number
  totalSymbols: number
  totalModules: number
  tiers: {
    hot: string[]
    warm: string[]
    cold: string[]
  }
}

// ─── Discovery ───

export interface DiscoveredFile {
  path: string          // relative to project root
  absolutePath: string
  language: string
  lines: number
  bytes: number
}

export interface ProjectInfo {
  name: string
  root: string
  type: 'node' | 'python' | 'go' | 'rust' | 'unknown'
  files: DiscoveredFile[]
  modules: string[]     // detected module directories
  entryPoints: string[]
  languages: string[]
}

// ─── Feedback ───

export interface FeedbackEntry {
  date: string
  file: string
  issue: string
  reporter: string
}

// ─── Pattern ───

export interface CodingPattern {
  name: string
  description: string
  example: string
  files: string[]
}
