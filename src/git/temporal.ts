import type { ChangeCoupling, Hotspot, BugRecord, TemporalData } from '../types/index.js'
import type { CommitInfo } from './history.js'
import { getCommitHistory } from './history.js'

// Files that pollute temporal metrics (changed every release, not real code risk)
const TEMPORAL_NOISE_FILES = new Set([
  'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md', 'NEWS.md',
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'go.sum', 'go.mod', 'poetry.lock', 'Pipfile.lock',
])

function isTemporalNoise(file: string): boolean {
  const basename = file.split('/').pop() ?? ''
  return TEMPORAL_NOISE_FILES.has(basename)
}

export async function analyzeTemporalData(root: string, days: number = 90): Promise<TemporalData> {
  const commits = await getCommitHistory(root, days)

  const hotspots = getHotspots(commits, days)
  const coupling = getChangeCoupling(commits)
  const bugHistory = getBugArchaeology(commits)

  return {
    generated: new Date().toISOString(),
    periodDays: days,
    totalCommits: commits.length,
    hotspots,
    coupling,
    bugHistory,
  }
}

export function getHotspots(commits: CommitInfo[], days: number): Hotspot[] {
  const fileChanges = new Map<string, { count: number; lastDate: string }>()

  for (const commit of commits) {
    for (const file of commit.filesChanged) {
      if (isTemporalNoise(file)) continue
      const existing = fileChanges.get(file) || { count: 0, lastDate: '' }
      existing.count++
      if (commit.date > existing.lastDate) {
        existing.lastDate = commit.date
      }
      fileChanges.set(file, existing)
    }
  }

  const now = new Date()
  const results: Hotspot[] = []

  for (const [file, data] of fileChanges) {
    const lastChanged = new Date(data.lastDate)
    const daysSinceChange = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24))

    let stability: Hotspot['stability']
    if (data.count >= 8 && daysSinceChange < 7) stability = 'volatile'
    else if (data.count >= 5 && daysSinceChange < 14) stability = 'stabilizing'
    else if (data.count >= 3) stability = 'moderate'
    else if (daysSinceChange > 30) stability = 'very_stable'
    else stability = 'stable'

    results.push({
      file,
      changes: data.count,
      stability,
      lastChanged: data.lastDate,
      daysSinceChange,
    })
  }

  // Sort by change frequency (descending)
  return results.sort((a, b) => b.changes - a.changes)
}

// Pairs that always co-change for trivial toolchain reasons, not real coupling
const NOISE_PAIRS: Array<[RegExp, RegExp]> = [
  [/go\.mod$/, /go\.sum$/],               // Go module + checksum
  [/Cargo\.toml$/, /Cargo\.lock$/],        // Rust manifest + lock
  [/\.golden$/, /\.golden$/],              // Golden test file clusters
]

function isCouplingNoise(fileA: string, fileB: string): boolean {
  // Same basename in same directory (e.g., file.ts ↔ file.test.ts is NOT noise)
  // But lock file pairs ARE noise
  for (const [patA, patB] of NOISE_PAIRS) {
    if ((patA.test(fileA) && patB.test(fileB)) || (patA.test(fileB) && patB.test(fileA))) {
      return true
    }
  }
  // Two golden files always co-change — filter entire clusters
  if (fileA.includes('.golden') && fileB.includes('.golden')) return true
  return false
}

export function getChangeCoupling(commits: CommitInfo[]): ChangeCoupling[] {
  const pairCounts = new Map<string, number>()
  const fileCounts = new Map<string, number>()

  for (const commit of commits) {
    const files = commit.filesChanged.filter(f =>
      !f.endsWith('.md') && !f.endsWith('.json') && !f.endsWith('.lock') && !f.endsWith('.yaml') && !f.endsWith('.yml')
    )

    // Count individual file changes
    for (const file of files) {
      fileCounts.set(file, (fileCounts.get(file) || 0) + 1)
    }

    // Skip mega-commits for pairing (refactors/renames create noise, not real coupling)
    if (files.length > 50) continue

    // Count pair co-changes
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join('|')
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  const results: ChangeCoupling[] = []

  for (const [key, cochanges] of pairCounts) {
    if (cochanges < 3) continue // Filter noise

    const parts = key.split('|')
    const fileA = parts[0] ?? ''
    const fileB = parts[1] ?? ''

    // Filter obvious coupling noise (lock file pairs, generated files)
    if (isCouplingNoise(fileA, fileB)) continue
    const maxChanges = Math.max(fileCounts.get(fileA) || 0, fileCounts.get(fileB) || 0)
    const strength = maxChanges > 0 ? cochanges / maxChanges : 0

    results.push({
      fileA,
      fileB,
      cochanges,
      strength: Math.round(strength * 100) / 100,
      hasImport: false, // Will be enriched by graph analysis
    })
  }

  // Sort by co-change frequency (descending)
  return results.sort((a, b) => b.cochanges - a.cochanges)
}

export function getBugArchaeology(commits: CommitInfo[]): BugRecord[] {
  const bugPatterns = /^(fix|bug|hotfix|patch)[\s:(]/i
  const fileRecords = new Map<string, { fixCommits: number; lessons: Set<string> }>()

  for (const commit of commits) {
    if (!bugPatterns.test(commit.message)) continue

    // Extract lesson from commit message
    const lesson = commit.message
      .replace(/^(fix|bug|hotfix|patch)[\s:(]+/i, '')
      .replace(/\s*\(#\d+\)$/, '') // Remove PR number
      .trim()

    for (const file of commit.filesChanged) {
      if (isTemporalNoise(file)) continue
      const existing = fileRecords.get(file) || { fixCommits: 0, lessons: new Set<string>() }
      existing.fixCommits++
      if (lesson) existing.lessons.add(lesson)
      fileRecords.set(file, existing)
    }
  }

  const results: BugRecord[] = []
  for (const [file, data] of fileRecords) {
    results.push({
      file,
      fixCommits: data.fixCommits,
      lessons: [...data.lessons],
    })
  }

  return results.sort((a, b) => b.fixCommits - a.fixCommits)
}

/**
 * Generate a pre-computed hotspots.md Markdown file from temporal data.
 * Used as a static file replacement for the get_hotspots MCP tool.
 */
export function generateHotspotsMarkdown(temporal: TemporalData): string {
  const lines: string[] = [
    '# Risk-Ranked Files',
    '',
    `> Auto-generated by CodeCortex. ${temporal.totalCommits} commits analyzed over ${temporal.periodDays} days.`,
    '',
  ]

  if (temporal.hotspots.length === 0) {
    lines.push('No hotspots detected.')
    return lines.join('\n') + '\n'
  }

  // Calculate risk scores (same formula as get_hotspots MCP tool)
  const riskMap = new Map<string, { churn: number; couplings: number; bugs: number; risk: number; stability: string }>()

  for (const h of temporal.hotspots) {
    riskMap.set(h.file, { churn: h.changes, couplings: 0, bugs: 0, risk: h.changes, stability: h.stability })
  }

  for (const c of temporal.coupling) {
    for (const f of [c.fileA, c.fileB]) {
      const entry = riskMap.get(f) || { churn: 0, couplings: 0, bugs: 0, risk: 0, stability: 'stable' }
      entry.couplings++
      entry.risk += c.strength * 2
      riskMap.set(f, entry)
    }
  }

  for (const b of temporal.bugHistory) {
    const entry = riskMap.get(b.file) || { churn: 0, couplings: 0, bugs: 0, risk: 0, stability: 'stable' }
    entry.bugs = b.fixCommits
    entry.risk += b.fixCommits * 3
    riskMap.set(b.file, entry)
  }

  const ranked = [...riskMap.entries()]
    .sort((a, b) => b[1].risk - a[1].risk)
    .slice(0, 30)

  lines.push('| File | Changes | Couplings | Bugs | Risk | Stability |')
  lines.push('|------|---------|-----------|------|------|-----------|')

  for (const [file, data] of ranked) {
    const risk = Math.round(data.risk * 100) / 100
    lines.push(`| \`${file}\` | ${data.churn} | ${data.couplings} | ${data.bugs} | ${risk} | ${data.stability} |`)
  }

  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)

  return lines.join('\n') + '\n'
}

export function getStabilitySignals(commits: CommitInfo[]): Map<string, { daysSinceChange: number; velocity: number }> {
  const now = new Date()
  const fileData = new Map<string, { lastDate: string; changes: number; firstDate: string }>()

  for (const commit of commits) {
    for (const file of commit.filesChanged) {
      const existing = fileData.get(file) || { lastDate: '', changes: 0, firstDate: commit.date }
      existing.changes++
      if (commit.date > existing.lastDate) existing.lastDate = commit.date
      if (commit.date < existing.firstDate) existing.firstDate = commit.date
      fileData.set(file, existing)
    }
  }

  const signals = new Map<string, { daysSinceChange: number; velocity: number }>()

  for (const [file, data] of fileData) {
    const last = new Date(data.lastDate)
    const first = new Date(data.firstDate)
    const daysSinceChange = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
    const spanDays = Math.max(1, Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)))
    const velocity = data.changes / spanDays * 30 // changes per 30 days

    signals.set(file, { daysSinceChange, velocity: Math.round(velocity * 100) / 100 })
  }

  return signals
}

export function getEvolutionEvents(commits: CommitInfo[]): { date: string; type: string; description: string; filesAffected: number }[] {
  const events: { date: string; type: string; description: string; filesAffected: number }[] = []

  const featPattern = /^feat[\s:(]/i
  const refactorPattern = /^refactor[\s:(]/i

  for (const commit of commits) {
    const fileCount = commit.filesChanged.length

    if (refactorPattern.test(commit.message) && fileCount >= 3) {
      events.push({
        date: commit.date,
        type: 'refactor',
        description: commit.message,
        filesAffected: fileCount,
      })
    } else if (featPattern.test(commit.message) && fileCount >= 5) {
      events.push({
        date: commit.date,
        type: 'feature',
        description: commit.message,
        filesAffected: fileCount,
      })
    } else if (fileCount >= 10) {
      events.push({
        date: commit.date,
        type: 'major_change',
        description: commit.message,
        filesAffected: fileCount,
      })
    }
  }

  return events
}
