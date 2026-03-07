import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const CACHE_FILE = join(tmpdir(), 'codecortex-update-check.json')
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const REGISTRY_URL = 'https://registry.npmjs.org/codecortex-ai/latest'
const FETCH_TIMEOUT = 3000

interface CachedCheck {
  latest: string
  lastCheck: number
}

interface VersionCheckResult {
  current: string
  latest: string
  isOutdated: boolean
}

function readCache(): CachedCheck | null {
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8')
    const data: unknown = JSON.parse(raw)
    if (
      typeof data === 'object' && data !== null &&
      'latest' in data && typeof data.latest === 'string' &&
      'lastCheck' in data && typeof data.lastCheck === 'number'
    ) {
      return data as CachedCheck
    }
    return null
  } catch {
    return null
  }
}

function writeCache(latest: string): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest, lastCheck: Date.now() }))
  } catch {
    // silent — cache is best-effort
  }
}

function compareVersions(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const c = parse(current)
  const l = parse(latest)
  const cMaj = c[0] ?? 0, cMin = c[1] ?? 0, cPatch = c[2] ?? 0
  const lMaj = l[0] ?? 0, lMin = l[1] ?? 0, lPatch = l[2] ?? 0
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    if (!res.ok) return null
    const data = await res.json() as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

/**
 * Check if a newer version is available on npm.
 * Returns immediately from cache if fresh, otherwise fires a background fetch.
 * Designed to never block or throw.
 */
export async function checkForUpdate(currentVersion: string): Promise<VersionCheckResult | null> {
  const cached = readCache()

  // Cache is fresh — return cached result without hitting network
  if (cached && Date.now() - cached.lastCheck < CACHE_TTL) {
    return {
      current: currentVersion,
      latest: cached.latest,
      isOutdated: compareVersions(currentVersion, cached.latest),
    }
  }

  // Cache is stale or missing — fetch from registry
  const latest = await fetchLatestVersion()
  if (!latest) return null

  writeCache(latest)

  return {
    current: currentVersion,
    latest,
    isOutdated: compareVersions(currentVersion, latest),
  }
}

/** Detect which package manager invoked this process */
export function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  const ua = process.env.npm_config_user_agent ?? ''
  if (ua.startsWith('yarn')) return 'yarn'
  if (ua.startsWith('pnpm')) return 'pnpm'
  if (ua.startsWith('bun')) return 'bun'

  // Fallback: inspect argv path
  const bin = process.argv[1] ?? ''
  if (bin.includes('yarn')) return 'yarn'
  if (bin.includes('pnpm')) return 'pnpm'
  if (bin.includes('bun')) return 'bun'

  return 'npm'
}

/** Get the correct upgrade command for the user's package manager */
export function getUpgradeCommand(): string {
  const pm = detectPackageManager()
  switch (pm) {
    case 'yarn': return 'yarn global add codecortex-ai@latest'
    case 'pnpm': return 'pnpm add -g codecortex-ai@latest'
    case 'bun': return 'bun add -g codecortex-ai@latest'
    default: return 'npm install -g codecortex-ai@latest'
  }
}

/** Should we show update notifications? */
export function shouldNotify(): boolean {
  if (process.env.CI || process.env.BUILD_NUMBER || process.env.RUN_ID) return false
  if (process.env.NO_UPDATE_NOTIFIER) return false
  if (process.env.NODE_ENV === 'test') return false
  if (!process.stderr.isTTY) return false
  return true
}

/** Render the update notification to stderr */
export function renderUpdateNotification(current: string, latest: string): void {
  const cmd = getUpgradeCommand()
  const yellow = '\x1b[33m'
  const cyan = '\x1b[36m'
  const dim = '\x1b[2m'
  const reset = '\x1b[0m'
  const bold = '\x1b[1m'

  // Dynamic width based on content (visible chars only)
  const line1Text = `Update available: ${current} → ${latest}`
  const line2Text = `Run ${cmd}`
  const contentWidth = Math.max(line1Text.length, line2Text.length)
  const innerWidth = contentWidth + 6 // 3 padding each side
  const rpad = (text: string) => ' '.repeat(Math.max(0, contentWidth - text.length + 3))

  const msg = [
    '',
    `${dim}╭${'─'.repeat(innerWidth)}╮${reset}`,
    `${dim}│${reset}${' '.repeat(innerWidth)}${dim}│${reset}`,
    `${dim}│${reset}   ${yellow}Update available:${reset} ${dim}${current}${reset} → ${cyan}${bold}${latest}${reset}${rpad(line1Text)}${dim}│${reset}`,
    `${dim}│${reset}   Run ${cyan}${cmd}${reset}${rpad(line2Text)}${dim}│${reset}`,
    `${dim}│${reset}${' '.repeat(innerWidth)}${dim}│${reset}`,
    `${dim}╰${'─'.repeat(innerWidth)}╯${reset}`,
    '',
  ].join('\n')

  process.stderr.write(msg)
}
