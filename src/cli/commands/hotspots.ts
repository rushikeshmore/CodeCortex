import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath, readFile } from '../../utils/files.js'
import type { TemporalData } from '../../types/index.js'

export async function hotspotsCommand(
  opts: { root: string; limit?: string },
): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.log('No CodeCortex knowledge found.')
    console.log(`Run 'codecortex init' to analyze this codebase.`)
    return
  }

  const content = await readFile(cortexPath(root, 'temporal.json'))
  if (!content) {
    console.log('No temporal data found. Run `codecortex init` in a git repository.')
    return
  }

  const temporal: TemporalData = JSON.parse(content)
  const limit = parseInt(opts.limit ?? '15', 10)

  // Same risk formula as MCP get_hotspots (read.ts:260-285)
  const riskMap = new Map<string, { churn: number; couplings: number; bugs: number; risk: number }>()

  for (const h of temporal.hotspots) {
    riskMap.set(h.file, { churn: h.changes, couplings: 0, bugs: 0, risk: h.changes })
  }

  for (const c of temporal.coupling) {
    for (const f of [c.fileA, c.fileB]) {
      const entry = riskMap.get(f) ?? { churn: 0, couplings: 0, bugs: 0, risk: 0 }
      entry.couplings++
      entry.risk += c.strength * 2
      riskMap.set(f, entry)
    }
  }

  for (const b of temporal.bugHistory) {
    const entry = riskMap.get(b.file) ?? { churn: 0, couplings: 0, bugs: 0, risk: 0 }
    entry.bugs = b.fixCommits
    entry.risk += b.fixCommits * 3
    riskMap.set(b.file, entry)
  }

  const ranked = [...riskMap.entries()]
    .sort((a, b) => b[1].risk - a[1].risk)
    .slice(0, limit)
    .map(([file, data]) => ({ file, ...data, risk: Math.round(data.risk * 100) / 100 }))

  console.log('')
  console.log(`Hotspots — ${temporal.periodDays} days, ${temporal.totalCommits} commits`)
  console.log('─'.repeat(70))
  console.log('')
  console.log(`  ${pad('#', 4)} ${pad('FILE', 42)} ${pad('CHURN', 6)} ${pad('CPLS', 5)} ${pad('BUGS', 5)} RISK`)

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i]!
    console.log(`  ${pad(String(i + 1), 4)} ${pad(r.file, 42)} ${pad(String(r.churn), 6)} ${pad(String(r.couplings), 5)} ${pad(String(r.bugs), 5)} ${r.risk.toFixed(2)}`)
  }

  // Hidden dependencies
  const hidden = temporal.coupling.filter(c => !c.hasImport && c.strength >= 0.3)
  if (hidden.length > 0) {
    console.log('')
    console.log('Hidden Dependencies (co-change but no import):')
    for (const h of hidden.slice(0, 10)) {
      console.log(`  ${h.fileA} <-> ${h.fileB}  (${h.cochanges} co-changes, ${Math.round(h.strength * 100)}%)`)
    }
    if (hidden.length > 10) {
      console.log(`  ... and ${hidden.length - 10} more`)
    }
  }

  console.log('')
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
