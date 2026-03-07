import { readManifest } from './manifest.js'
import { getChangedFilesSinceDate } from '../git/diff.js'
import { isGitRepo } from '../git/history.js'

export type FreshnessStatus = 'fresh' | 'slightly_stale' | 'stale' | 'very_stale'

export interface FreshnessInfo {
  status: FreshnessStatus
  lastAnalyzed: string
  daysSinceAnalysis: number
  filesChangedSince: number
  changedFiles: string[]
  message: string
}

/**
 * Compute freshness of .codecortex/ knowledge relative to the actual codebase.
 * Compares manifest.lastUpdated against git changes since that date.
 */
export async function computeFreshness(projectRoot: string): Promise<FreshnessInfo | null> {
  const manifest = await readManifest(projectRoot)
  if (!manifest) return null

  const lastUpdated = manifest.lastUpdated
  if (!lastUpdated) return null

  const isRepo = await isGitRepo(projectRoot)
  let changedFiles: string[] = []

  if (isRepo) {
    try {
      changedFiles = await getChangedFilesSinceDate(projectRoot, lastUpdated)
      // Filter out noise files that don't affect knowledge quality
      changedFiles = changedFiles.filter(f => {
        const base = f.split('/').pop() ?? ''
        return !base.endsWith('.lock') &&
          base !== 'package-lock.json' &&
          base !== 'yarn.lock' &&
          base !== 'pnpm-lock.yaml' &&
          base !== 'CHANGELOG.md' &&
          !f.startsWith('.codecortex/')
      })
    } catch {
      // Git operation failed — can't determine freshness from git
      changedFiles = []
    }
  }

  const now = new Date()
  const analyzed = new Date(lastUpdated)
  const daysSinceAnalysis = Math.floor((now.getTime() - analyzed.getTime()) / (1000 * 60 * 60 * 24))

  const count = changedFiles.length
  let status: FreshnessStatus
  let message: string

  if (count === 0 && daysSinceAnalysis <= 7) {
    status = 'fresh'
    message = 'Knowledge is up to date.'
  } else if (count <= 2 && daysSinceAnalysis <= 7) {
    status = 'slightly_stale'
    message = `${count} file${count === 1 ? '' : 's'} changed since last analysis. Minor drift.`
  } else if (count <= 5 || daysSinceAnalysis <= 14) {
    status = 'stale'
    message = `${count} file${count === 1 ? '' : 's'} changed since last analysis. Consider running \`codecortex update\`.`
  } else {
    status = 'very_stale'
    message = `${count} files changed over ${daysSinceAnalysis} days since last analysis. Run \`codecortex update\` before trusting this knowledge.`
  }

  return {
    status,
    lastAnalyzed: lastUpdated,
    daysSinceAnalysis,
    filesChangedSince: count,
    changedFiles: changedFiles.slice(0, 20), // Cap to avoid bloating response
    message,
  }
}
