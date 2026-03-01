import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath, readFile } from '../../utils/files.js'
import { readManifest } from '../../core/manifest.js'
import { listModuleDocs } from '../../core/modules.js'
import { listDecisions } from '../../core/decisions.js'
import { listSessions, getLatestSession } from '../../core/sessions.js'
import type { SymbolIndex, TemporalData } from '../../types/index.js'

export async function statusCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.log('No CodeCortex knowledge found.')
    console.log(`Run 'codecortex init' to analyze this codebase.`)
    return
  }

  const manifest = await readManifest(root)
  if (!manifest) {
    console.log('Error reading cortex.yaml')
    return
  }

  console.log(`CodeCortex Status — ${manifest.project}`)
  console.log('─'.repeat(50))
  console.log('')

  // Core stats
  console.log('Knowledge Store:')
  console.log(`  Version:     ${manifest.version}`)
  console.log(`  Languages:   ${manifest.languages.join(', ')}`)
  console.log(`  Files:       ${manifest.totalFiles}`)
  console.log(`  Symbols:     ${manifest.totalSymbols}`)
  console.log(`  Modules:     ${manifest.totalModules}`)
  console.log(`  Generated:   ${manifest.generated}`)
  console.log(`  Last updated: ${manifest.lastUpdated}`)
  console.log('')

  // Freshness
  const lastUpdated = new Date(manifest.lastUpdated)
  const ageHours = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60))
  const ageLabel = ageHours < 1 ? 'just now' :
    ageHours < 24 ? `${ageHours} hours ago` :
    `${Math.floor(ageHours / 24)} days ago`
  console.log(`Freshness: ${ageLabel}`)
  if (ageHours > 24) {
    console.log('  Consider running `codecortex update` to refresh.')
  }
  console.log('')

  // Knowledge breakdown
  const modules = await listModuleDocs(root)
  const decisions = await listDecisions(root)
  const sessions = await listSessions(root)

  console.log('Knowledge Breakdown:')
  console.log(`  Module docs:      ${modules.length}${modules.length > 0 ? ` (${modules.join(', ')})` : ''}`)
  console.log(`  Decision records: ${decisions.length}`)
  console.log(`  Session logs:     ${sessions.length}`)

  // Check for patterns
  const patterns = await readFile(cortexPath(root, 'patterns.md'))
  const patternCount = patterns ? (patterns.match(/^### /gm) || []).length : 0
  console.log(`  Coding patterns:  ${patternCount}`)
  console.log('')

  // Symbol breakdown
  const symbolContent = await readFile(cortexPath(root, 'symbols.json'))
  if (symbolContent) {
    const index: SymbolIndex = JSON.parse(symbolContent)
    const byKind = new Map<string, number>()
    for (const s of index.symbols) {
      byKind.set(s.kind, (byKind.get(s.kind) || 0) + 1)
    }
    console.log('Symbol Index:')
    for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${kind}: ${count}`)
    }
    const exported = index.symbols.filter(s => s.exported).length
    console.log(`  Total exported: ${exported}/${index.total}`)
    console.log('')
  }

  // Temporal summary
  const temporalContent = await readFile(cortexPath(root, 'temporal.json'))
  if (temporalContent) {
    const temporal: TemporalData = JSON.parse(temporalContent)
    console.log('Temporal Analysis:')
    console.log(`  Period: ${temporal.periodDays} days, ${temporal.totalCommits} commits`)
    console.log(`  Hotspots: ${temporal.hotspots.filter(h => h.stability === 'volatile').length} volatile, ${temporal.hotspots.filter(h => h.stability === 'stabilizing').length} stabilizing`)
    console.log(`  Couplings: ${temporal.coupling.length} pairs (${temporal.coupling.filter(c => !c.hasImport).length} hidden)`)
    console.log(`  Bug records: ${temporal.bugHistory.length} files with fix history`)

    // Top 3 hotspots
    const top = temporal.hotspots.slice(0, 3)
    if (top.length > 0) {
      console.log(`  Top hotspots:`)
      for (const h of top) {
        console.log(`    ${h.file} — ${h.changes} changes (${h.stability})`)
      }
    }
  }

  // Feedback
  const feedbackContent = await readFile(cortexPath(root, 'feedback', 'log.json'))
  if (feedbackContent) {
    const feedback = JSON.parse(feedbackContent)
    if (feedback.length > 0) {
      console.log('')
      console.log(`Pending feedback: ${feedback.length} reports (will be addressed on next update)`)
    }
  }

  // Latest session
  const latestSession = await getLatestSession(root)
  if (latestSession) {
    console.log('')
    console.log(`Latest session: ${latestSession}`)
  }
}
