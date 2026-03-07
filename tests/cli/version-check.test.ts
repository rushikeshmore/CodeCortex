import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'

// Import pure functions to test
import {
  checkForUpdate,
  detectPackageManager,
  getUpgradeCommand,
  shouldNotify,
  renderUpdateNotification,
} from '../../src/cli/utils/version-check.js'

const CACHE_FILE = join(tmpdir(), 'codecortex-update-check.json')

function clearCache(): void {
  try { unlinkSync(CACHE_FILE) } catch { /* ignore */ }
}

describe('compareVersions (via checkForUpdate)', () => {
  beforeEach(() => clearCache())
  afterEach(() => clearCache())

  it('detects outdated when latest is newer major', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '2.0.0', lastCheck: Date.now() }))
    const result = await checkForUpdate('1.0.0')
    expect(result).not.toBeNull()
    expect(result!.isOutdated).toBe(true)
  })

  it('detects outdated when latest is newer minor', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.4.0', lastCheck: Date.now() }))
    const result = await checkForUpdate('0.3.2')
    expect(result).not.toBeNull()
    expect(result!.isOutdated).toBe(true)
  })

  it('detects outdated when latest is newer patch', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.3.3', lastCheck: Date.now() }))
    const result = await checkForUpdate('0.3.2')
    expect(result).not.toBeNull()
    expect(result!.isOutdated).toBe(true)
  })

  it('detects up-to-date when versions match', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.3.2', lastCheck: Date.now() }))
    const result = await checkForUpdate('0.3.2')
    expect(result).not.toBeNull()
    expect(result!.isOutdated).toBe(false)
  })

  it('detects up-to-date when current is newer', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.3.0', lastCheck: Date.now() }))
    const result = await checkForUpdate('0.3.2')
    expect(result).not.toBeNull()
    expect(result!.isOutdated).toBe(false)
  })

  it('uses cache when fresh (does not fetch)', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '1.0.0', lastCheck: Date.now() }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await checkForUpdate('0.3.2')
    expect(result!.isOutdated).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('fetches from registry when cache is stale', async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.1.0', lastCheck: staleTime }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.5.0' }), { status: 200 })
    )
    const result = await checkForUpdate('0.3.2')
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result!.latest).toBe('0.5.0')
    expect(result!.isOutdated).toBe(true)
    fetchSpy.mockRestore()
  })

  it('returns null when cache is stale and fetch fails', async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: '0.1.0', lastCheck: staleTime }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    const result = await checkForUpdate('0.3.2')
    expect(result).toBeNull()
    fetchSpy.mockRestore()
  })

  it('returns null when no cache and fetch fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const result = await checkForUpdate('0.3.2')
    expect(result).toBeNull()
    fetchSpy.mockRestore()
  })

  it('handles corrupted cache file gracefully', async () => {
    writeFileSync(CACHE_FILE, 'not json at all')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.4.0' }), { status: 200 })
    )
    const result = await checkForUpdate('0.3.2')
    expect(result!.latest).toBe('0.4.0')
    expect(result!.isOutdated).toBe(true)
    fetchSpy.mockRestore()
  })

  it('rejects cache with valid JSON but wrong shape', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ foo: 'bar' }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.5.0' }), { status: 200 })
    )
    const result = await checkForUpdate('0.3.2')
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result!.latest).toBe('0.5.0')
    fetchSpy.mockRestore()
  })

  it('handles v-prefixed versions', async () => {
    writeFileSync(CACHE_FILE, JSON.stringify({ latest: 'v1.0.0', lastCheck: Date.now() }))
    const result = await checkForUpdate('v0.3.2')
    expect(result!.isOutdated).toBe(true)
  })
})

describe('detectPackageManager', () => {
  const originalUa = process.env.npm_config_user_agent

  afterEach(() => {
    if (originalUa !== undefined) {
      process.env.npm_config_user_agent = originalUa
    } else {
      delete process.env.npm_config_user_agent
    }
  })

  it('detects npm from user agent', () => {
    process.env.npm_config_user_agent = 'npm/10.0.0 node/v20.0.0'
    expect(detectPackageManager()).toBe('npm')
  })

  it('detects yarn from user agent', () => {
    process.env.npm_config_user_agent = 'yarn/1.22.0 npm/? node/v20.0.0'
    expect(detectPackageManager()).toBe('yarn')
  })

  it('detects pnpm from user agent', () => {
    process.env.npm_config_user_agent = 'pnpm/8.0.0 npm/? node/v20.0.0'
    expect(detectPackageManager()).toBe('pnpm')
  })

  it('detects bun from user agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0'
    expect(detectPackageManager()).toBe('bun')
  })

  it('defaults to npm when no user agent', () => {
    delete process.env.npm_config_user_agent
    expect(detectPackageManager()).toBe('npm')
  })
})

describe('getUpgradeCommand', () => {
  const originalUa = process.env.npm_config_user_agent

  afterEach(() => {
    if (originalUa !== undefined) {
      process.env.npm_config_user_agent = originalUa
    } else {
      delete process.env.npm_config_user_agent
    }
  })

  it('returns npm command by default', () => {
    delete process.env.npm_config_user_agent
    expect(getUpgradeCommand()).toBe('npm install -g codecortex-ai@latest')
  })

  it('returns yarn command for yarn', () => {
    process.env.npm_config_user_agent = 'yarn/1.22.0'
    expect(getUpgradeCommand()).toBe('yarn global add codecortex-ai@latest')
  })

  it('returns pnpm command for pnpm', () => {
    process.env.npm_config_user_agent = 'pnpm/8.0.0'
    expect(getUpgradeCommand()).toBe('pnpm add -g codecortex-ai@latest')
  })

  it('returns bun command for bun', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0'
    expect(getUpgradeCommand()).toBe('bun add -g codecortex-ai@latest')
  })
})

describe('shouldNotify', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved.CI = process.env.CI
    saved.BUILD_NUMBER = process.env.BUILD_NUMBER
    saved.RUN_ID = process.env.RUN_ID
    saved.NO_UPDATE_NOTIFIER = process.env.NO_UPDATE_NOTIFIER
    saved.NODE_ENV = process.env.NODE_ENV
    // Clear all
    delete process.env.CI
    delete process.env.BUILD_NUMBER
    delete process.env.RUN_ID
    delete process.env.NO_UPDATE_NOTIFIER
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    for (const [key, val] of Object.entries(saved)) {
      if (val !== undefined) process.env[key] = val
      else delete process.env[key]
    }
  })

  it('returns false when CI is set', () => {
    process.env.CI = 'true'
    expect(shouldNotify()).toBe(false)
  })

  it('returns false when BUILD_NUMBER is set', () => {
    process.env.BUILD_NUMBER = '123'
    expect(shouldNotify()).toBe(false)
  })

  it('returns false when NO_UPDATE_NOTIFIER is set', () => {
    process.env.NO_UPDATE_NOTIFIER = '1'
    expect(shouldNotify()).toBe(false)
  })

  it('returns false when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test'
    expect(shouldNotify()).toBe(false)
  })
})

describe('renderUpdateNotification', () => {
  it('writes to stderr with versions and upgrade command', () => {
    delete process.env.npm_config_user_agent
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    renderUpdateNotification('0.1.0', '0.4.0')
    expect(writeSpy).toHaveBeenCalledOnce()
    const output = writeSpy.mock.calls[0]![0] as string
    expect(output).toContain('0.1.0')
    expect(output).toContain('0.4.0')
    expect(output).toContain('Update available')
    expect(output).toContain('npm install -g codecortex-ai@latest')
    writeSpy.mockRestore()
  })

  it('handles long version strings without crashing', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    renderUpdateNotification('10.10.10', '20.20.20')
    expect(writeSpy).toHaveBeenCalledOnce()
    const output = writeSpy.mock.calls[0]![0] as string
    expect(output).toContain('10.10.10')
    expect(output).toContain('20.20.20')
    writeSpy.mockRestore()
  })

  it('box lines have consistent visible width', () => {
    delete process.env.npm_config_user_agent
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    renderUpdateNotification('0.1.0', '0.4.0')
    const output = writeSpy.mock.calls[0]![0] as string
    // Strip ANSI codes to check alignment
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '')
    const lines = stripped.split('\n').filter(l => l.includes('│') || l.includes('╭') || l.includes('╰'))
    // All box lines should have the same visual width
    const widths = lines.map(l => l.length)
    expect(new Set(widths).size).toBe(1)
    writeSpy.mockRestore()
  })
})
