import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from 'node:fs/promises'
import { readFile, cortexPath } from '../utils/files.js'
import { readManifest } from './manifest.js'
import type { TemporalData, DependencyGraph } from '../types/index.js'

const MARKER_START = '<!-- codecortex:start -->'
const MARKER_END = '<!-- codecortex:end -->'
const OLD_POINTER_PATTERN = /## CodeCortex\nThis project uses CodeCortex[^\n]*\. See[^\n]*AGENT\.md[^\n]*/

// Max items shown in inline context
const INLINE_CAPS = {
  modules: 10,
  hotspots: 5,
  couplings: 3,
  externalDeps: 5,
  bugFiles: 3,
}

// All known agent instruction files across AI coding tools
export const AGENT_CONFIG_FILES = [
  'CLAUDE.md',           // Claude Code, Claude Desktop
  '.cursorrules',        // Cursor
  '.windsurfrules',      // Windsurf
  'AGENTS.md',           // Generic / multi-agent convention
  '.github/copilot-instructions.md', // GitHub Copilot
]

/**
 * Generate inline context from .codecortex/ data.
 * Reads pre-computed knowledge files and synthesizes a ~60-80 line Markdown section.
 */
export async function generateInlineContext(projectRoot: string): Promise<string> {
  const manifest = await readManifest(projectRoot)

  // Read temporal data
  let temporal: TemporalData | null = null
  const temporalContent = await readFile(cortexPath(projectRoot, 'temporal.json'))
  if (temporalContent) {
    try { temporal = JSON.parse(temporalContent) as TemporalData } catch { /* skip */ }
  }

  // Read graph for modules + entry points
  let graph: DependencyGraph | null = null
  const graphContent = await readFile(cortexPath(projectRoot, 'graph.json'))
  if (graphContent) {
    try { graph = JSON.parse(graphContent) as DependencyGraph } catch { /* skip */ }
  }

  const lines: string[] = [
    MARKER_START,
    '## CodeCortex — Project Knowledge (auto-updated)',
    '',
  ]

  // --- Architecture section (skip for trivially small repos with 0 modules) ---
  const hasModules = graph && graph.modules.length > 0
  if (manifest || hasModules) {
    lines.push('### Architecture')

    if (manifest) {
      lines.push(`**${manifest.project}** — ${manifest.languages.join(', ')} — ${manifest.totalFiles} files, ${manifest.totalSymbols} symbols`)
    }

    if (graph) {
      // Modules (sorted by size, capped)
      if (graph.modules.length > 0) {
        const sorted = [...graph.modules].sort((a, b) => b.lines - a.lines)
        const shown = sorted.slice(0, INLINE_CAPS.modules)
        const modList = shown.map(m => `${m.name} (${m.lines}loc)`).join(', ')
        const suffix = graph.modules.length > INLINE_CAPS.modules ? `, +${graph.modules.length - INLINE_CAPS.modules} more` : ''
        lines.push(`- **Modules (${graph.modules.length}):** ${modList}${suffix}`)
      }

      // Entry points
      if (graph.entryPoints.length > 0) {
        lines.push(`- **Entry points:** ${graph.entryPoints.map(e => `\`${e}\``).join(', ')}`)
      }

      // External deps
      const extDeps = Object.keys(graph.externalDeps)
      if (extDeps.length > 0) {
        const shown = extDeps.slice(0, INLINE_CAPS.externalDeps)
        const suffix = extDeps.length > INLINE_CAPS.externalDeps ? `, +${extDeps.length - INLINE_CAPS.externalDeps} more` : ''
        lines.push(`- **Key deps:** ${shown.join(', ')}${suffix}`)
      }
    }

    lines.push('')
  }

  // --- Risk Map section ---
  if (temporal && (temporal.hotspots.length > 0 || temporal.coupling.length > 0)) {
    lines.push('### Risk Map')

    // Top hotspots with coupling context (show WHAT is coupled, not just counts)
    const topHotspots = temporal.hotspots.slice(0, INLINE_CAPS.hotspots)
    if (topHotspots.length > 0) {
      lines.push('**High-risk files:**')
      for (const h of topHotspots) {
        const fileCouplings = temporal.coupling.filter(
          c => c.fileA === h.file || c.fileB === h.file
        )
        const bugs = temporal.bugHistory.find(b => b.file === h.file)

        const parts = [`${h.changes} changes`]
        if (bugs) parts.push(`${bugs.fixCommits} bug-fixes`)
        parts.push(h.stability)

        // Show top 2 coupled files by name instead of just a count
        if (fileCouplings.length > 0) {
          const topCoupled = fileCouplings
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 2)
            .map(c => {
              const other = c.fileA === h.file ? c.fileB : c.fileA
              const shortName = other.split('/').pop() ?? other
              return `${shortName}${c.hasImport ? '' : ' ⚠'}`
            })
          parts.push(`coupled to: ${topCoupled.join(', ')}`)
        }

        lines.push(`- \`${h.file}\` — ${parts.join(', ')}`)
      }
    }

    // Hidden couplings (co-change but no import)
    const hidden = temporal.coupling.filter(c => !c.hasImport && c.strength >= 0.5)
    if (hidden.length > 0) {
      lines.push('')
      lines.push('**Hidden couplings (co-change, no import):**')
      for (const c of hidden.slice(0, INLINE_CAPS.couplings)) {
        lines.push(`- \`${c.fileA}\` ↔ \`${c.fileB}\` (${Math.round(c.strength * 100)}% co-change)`)
      }
    }

    // Bug-prone files (only if not already shown in hotspots)
    const hotspotFiles = new Set(topHotspots.map(h => h.file))
    const buggy = temporal.bugHistory.filter(b => b.fixCommits >= 2 && !hotspotFiles.has(b.file))
    if (buggy.length > 0) {
      lines.push('')
      lines.push('**Bug-prone files:**')
      for (const b of buggy.slice(0, INLINE_CAPS.bugFiles)) {
        lines.push(`- \`${b.file}\` — ${b.fixCommits} bug-fix commits`)
      }
    }

    lines.push('')
  }

  // --- Before Editing directive ---
  lines.push('### Before Editing')
  lines.push('Check `.codecortex/hotspots.md` for risk-ranked files before editing.')
  lines.push('If CodeCortex MCP tools are available, call `get_edit_briefing` for coupling + risk details.')
  lines.push('If not, read `.codecortex/modules/<module>.md` for the relevant module\'s dependencies and bug history.')
  lines.push('')

  // --- Static Knowledge (primary — always available) ---
  lines.push('### Project Knowledge')
  lines.push('Read these files directly (always available, no tool call needed):')
  lines.push('- `.codecortex/hotspots.md` — risk-ranked files with coupling + bug data')
  lines.push('- `.codecortex/modules/*.md` — module docs, dependencies, temporal signals')
  lines.push('- `.codecortex/constitution.md` — full architecture overview')
  lines.push('- `.codecortex/patterns.md` — coding conventions')
  lines.push('- `.codecortex/decisions/*.md` — architectural decisions')
  lines.push('')

  // --- MCP Tools (secondary — only if server is connected) ---
  lines.push('### MCP Tools (if available)')
  lines.push('If a CodeCortex MCP server is connected, these tools provide live analysis:')
  lines.push('- `get_edit_briefing` — risk + coupling + bugs for files you plan to edit.')
  lines.push('- `get_change_coupling` — files that co-change (hidden dependencies).')
  lines.push('- `get_project_overview` — architecture + dependency graph summary.')
  lines.push('- `get_dependency_graph` — scoped import/call graph for file or module.')
  lines.push('- `lookup_symbol` — precise symbol search (name, kind, file filters).')
  lines.push(MARKER_END)

  return lines.join('\n') + '\n'
}

/**
 * Inject inline context into a single file.
 * Handles three cases:
 * 1. New markers present → replace between markers
 * 2. Old 3-line pointer present → remove old, insert new with markers
 * 3. Neither → append at end
 */
export async function injectIntoFile(filePath: string, content: string): Promise<boolean> {
  // Ensure parent directory exists
  const dir = join(filePath, '..')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  if (!existsSync(filePath)) {
    // Create new file with just the inline context
    await fsWriteFile(filePath, content, 'utf-8')
    return true
  }

  const existing = await fsReadFile(filePath, 'utf-8')

  // Case 1: Markers already present → replace between them
  const startIdx = existing.indexOf(MARKER_START)
  const endIdx = existing.indexOf(MARKER_END)
  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + MARKER_END.length)
    const newContent = before + content.trimEnd() + after
    if (newContent === existing) return false // No change
    await fsWriteFile(filePath, newContent, 'utf-8')
    return true
  }

  // Case 2: Old pointer present → remove it, append new section
  if (OLD_POINTER_PATTERN.test(existing)) {
    const cleaned = existing.replace(OLD_POINTER_PATTERN, '').trimEnd()
    await fsWriteFile(filePath, cleaned + '\n\n' + content, 'utf-8')
    return true
  }

  // Case 3: Neither → append
  if (existing.includes(MARKER_START)) return false // Partial marker, don't corrupt
  await fsWriteFile(filePath, existing.trimEnd() + '\n\n' + content, 'utf-8')
  return true
}

/**
 * Inject inline context into all detected agent config files.
 * If no config files exist, creates CLAUDE.md.
 */
export async function injectAllAgentFiles(projectRoot: string): Promise<string[]> {
  const content = await generateInlineContext(projectRoot)
  const updated: string[] = []
  let foundAny = false

  for (const file of AGENT_CONFIG_FILES) {
    const filePath = join(projectRoot, file)
    if (existsSync(filePath)) {
      foundAny = true
      const wasUpdated = await injectIntoFile(filePath, content)
      if (wasUpdated) updated.push(file)
    }
  }

  // If no agent config files exist, create CLAUDE.md
  if (!foundAny) {
    const filePath = join(projectRoot, 'CLAUDE.md')
    await injectIntoFile(filePath, content)
    updated.push('CLAUDE.md')
  }

  return updated
}
