/**
 * Project size classification.
 *
 * Determines response truncation limits based on project scale.
 * Small repos get full detail; large repos get intelligent summaries.
 *
 * Calibrated against real-world repos:
 *   micro:       AgentKarma (23 files, 605 symbols)
 *   small:       CodeCortex (57 files, 1.3K symbols), supabase TS (~100 files)
 *   medium:      nestjs (~500 files, 60K LOC), storybook (~1K files)
 *   large:       OpenClaw (6.4K files, 143K symbols), vscode (~6K files)
 *   extra-large: kibana (~20K files, 2.7M LOC), Linux kernel (93K files)
 *
 * Primary signal: file count (most predictable of response size).
 * Secondary signal: symbol count (catches dense codebases with few but heavy files).
 * Module count used as tiebreaker for edge cases.
 */

export type ProjectSize = 'micro' | 'small' | 'medium' | 'large' | 'extra-large'

export function classifyProject(totalFiles: number, totalSymbols: number, _totalModules: number): ProjectSize {
  // File count is the primary signal — it most directly predicts response size
  // (more files = more graph edges, module members, coupling pairs).
  // Symbols only bump the classification UP by one tier if disproportionately high,
  // catching dense codebases (few files but many exports/functions).
  const byFiles = classifyByFiles(totalFiles)
  const bySymbols = classifyBySymbols(totalSymbols)

  const filesIdx = SIZE_ORDER.indexOf(byFiles)
  const symbolsIdx = SIZE_ORDER.indexOf(bySymbols)

  // Symbols can bump up by at most 1 tier (prevents 23-file project becoming "medium")
  if (symbolsIdx > filesIdx) {
    return SIZE_ORDER[Math.min(filesIdx + 1, symbolsIdx)]!
  }
  return byFiles
}

const SIZE_ORDER: ProjectSize[] = ['micro', 'small', 'medium', 'large', 'extra-large']

function classifyByFiles(files: number): ProjectSize {
  if (files <= 30) return 'micro'
  if (files <= 200) return 'small'
  if (files <= 2_000) return 'medium'
  if (files <= 10_000) return 'large'
  return 'extra-large'
}

function classifyBySymbols(symbols: number): ProjectSize {
  if (symbols <= 1_000) return 'micro'
  if (symbols <= 5_000) return 'small'
  if (symbols <= 50_000) return 'medium'
  if (symbols <= 300_000) return 'large'
  return 'extra-large'
}

export interface SizeLimits {
  // Constitution
  constitutionModules: number
  constitutionDeps: number
  constitutionHotspots: number
  constitutionCouplings: number
  constitutionBugs: number
  constitutionLessons: number

  // Module context (tool 2)
  moduleDocCap: number
  depModuleNameCap: number
  depExternalCap: number

  // Dependency graph (tool 6)
  graphEdgeCap: number
  graphCallCap: number
  graphFileEdgeCap: number

  // Other tools
  symbolMatchCap: number
  couplingCap: number
  importersCap: number
  decisionCap: number
  decisionCharCap: number
  sessionsCap: number
  searchDefaultLimit: number

  // Module doc generation
  moduleExportedSymbolCap: number
  moduleFileSampleCap: number
}

const LIMITS: Record<ProjectSize, SizeLimits> = {
  'micro': {
    constitutionModules: 100, constitutionDeps: 50, constitutionHotspots: 5,
    constitutionCouplings: 5, constitutionBugs: 5, constitutionLessons: 3,
    moduleDocCap: 20_000, depModuleNameCap: 50, depExternalCap: 30,
    graphEdgeCap: 50, graphCallCap: 30, graphFileEdgeCap: 50,
    symbolMatchCap: 50, couplingCap: 50, importersCap: 50,
    decisionCap: 20, decisionCharCap: 4000, sessionsCap: 10,
    searchDefaultLimit: 10,
    moduleExportedSymbolCap: 50, moduleFileSampleCap: 5,
  },
  'small': {
    constitutionModules: 50, constitutionDeps: 30, constitutionHotspots: 5,
    constitutionCouplings: 5, constitutionBugs: 5, constitutionLessons: 3,
    moduleDocCap: 15_000, depModuleNameCap: 30, depExternalCap: 20,
    graphEdgeCap: 40, graphCallCap: 25, graphFileEdgeCap: 40,
    symbolMatchCap: 40, couplingCap: 40, importersCap: 40,
    decisionCap: 15, decisionCharCap: 3000, sessionsCap: 8,
    searchDefaultLimit: 15,
    moduleExportedSymbolCap: 40, moduleFileSampleCap: 5,
  },
  'medium': {
    constitutionModules: 30, constitutionDeps: 25, constitutionHotspots: 5,
    constitutionCouplings: 5, constitutionBugs: 5, constitutionLessons: 3,
    moduleDocCap: 10_000, depModuleNameCap: 20, depExternalCap: 15,
    graphEdgeCap: 25, graphCallCap: 15, graphFileEdgeCap: 25,
    symbolMatchCap: 30, couplingCap: 30, importersCap: 30,
    decisionCap: 10, decisionCharCap: 2000, sessionsCap: 5,
    searchDefaultLimit: 20,
    moduleExportedSymbolCap: 25, moduleFileSampleCap: 3,
  },
  'large': {
    constitutionModules: 20, constitutionDeps: 20, constitutionHotspots: 5,
    constitutionCouplings: 5, constitutionBugs: 5, constitutionLessons: 3,
    moduleDocCap: 8_000, depModuleNameCap: 15, depExternalCap: 10,
    graphEdgeCap: 15, graphCallCap: 10, graphFileEdgeCap: 20,
    symbolMatchCap: 30, couplingCap: 30, importersCap: 30,
    decisionCap: 10, decisionCharCap: 2000, sessionsCap: 5,
    searchDefaultLimit: 20,
    moduleExportedSymbolCap: 20, moduleFileSampleCap: 3,
  },
  'extra-large': {
    constitutionModules: 15, constitutionDeps: 15, constitutionHotspots: 5,
    constitutionCouplings: 5, constitutionBugs: 5, constitutionLessons: 3,
    moduleDocCap: 6_000, depModuleNameCap: 10, depExternalCap: 8,
    graphEdgeCap: 10, graphCallCap: 8, graphFileEdgeCap: 15,
    symbolMatchCap: 20, couplingCap: 25, importersCap: 25,
    decisionCap: 8, decisionCharCap: 1500, sessionsCap: 5,
    searchDefaultLimit: 20,
    moduleExportedSymbolCap: 15, moduleFileSampleCap: 3,
  },
}

export type DetailLevel = 'brief' | 'full'

/** Hard cap for "full" detail mode — prevents runaway responses. */
const FULL_HARD_CAP: SizeLimits = {
  constitutionModules: 100, constitutionDeps: 50, constitutionHotspots: 10,
  constitutionCouplings: 10, constitutionBugs: 10, constitutionLessons: 5,
  moduleDocCap: 50_000, depModuleNameCap: 100, depExternalCap: 50,
  graphEdgeCap: 100, graphCallCap: 50, graphFileEdgeCap: 100,
  symbolMatchCap: 100, couplingCap: 100, importersCap: 100,
  decisionCap: 50, decisionCharCap: 10_000, sessionsCap: 20,
  searchDefaultLimit: 50,
  moduleExportedSymbolCap: 100, moduleFileSampleCap: 10,
}

export function getSizeLimits(size: ProjectSize, detail: DetailLevel = 'brief'): SizeLimits {
  if (detail === 'full') return FULL_HARD_CAP
  return LIMITS[size]
}
