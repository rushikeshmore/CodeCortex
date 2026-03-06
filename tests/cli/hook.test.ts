import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import simpleGit from 'simple-git'
import {
  hasCodeCortexHook,
  removeCodeCortexHook,
  isEmptyHook,
  hookInstallCommand,
  hookUninstallCommand,
  hookStatusCommand,
} from '../../src/cli/commands/hook.js'

// --- Pure function tests ---

describe('hasCodeCortexHook', () => {
  it('returns true when marker is present', () => {
    const content = '#!/bin/sh\n# --- codecortex-hook-start ---\nstuff\n# --- codecortex-hook-end ---\n'
    expect(hasCodeCortexHook(content)).toBe(true)
  })

  it('returns false when no marker', () => {
    expect(hasCodeCortexHook('#!/bin/sh\necho hello\n')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasCodeCortexHook('')).toBe(false)
  })
})

describe('removeCodeCortexHook', () => {
  it('removes the demarcated section', () => {
    const content = '#!/bin/sh\necho before\n# --- codecortex-hook-start ---\ncodecortex update\n# --- codecortex-hook-end ---\necho after\n'
    const result = removeCodeCortexHook(content)
    expect(result).toContain('echo before')
    expect(result).toContain('echo after')
    expect(result).not.toContain('codecortex-hook-start')
    expect(result).not.toContain('codecortex update')
  })

  it('returns content unchanged if no markers', () => {
    const content = '#!/bin/sh\necho hello\n'
    expect(removeCodeCortexHook(content)).toBe(content)
  })

  it('handles section at end of file', () => {
    const content = '#!/bin/sh\n# --- codecortex-hook-start ---\nstuff\n# --- codecortex-hook-end ---\n'
    const result = removeCodeCortexHook(content)
    expect(result).not.toContain('codecortex-hook-start')
    expect(result).toBe('#!/bin/sh\n')
  })
})

describe('isEmptyHook', () => {
  it('returns true for shebang-only file', () => {
    expect(isEmptyHook('#!/bin/sh\n')).toBe(true)
  })

  it('returns true for shebang + comments', () => {
    expect(isEmptyHook('#!/bin/sh\n# some comment\n\n')).toBe(true)
  })

  it('returns false if there is actual content', () => {
    expect(isEmptyHook('#!/bin/sh\necho hello\n')).toBe(false)
  })

  it('returns true for empty string', () => {
    expect(isEmptyHook('')).toBe(true)
  })
})

// --- Integration tests ---

describe('hook commands (integration)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecortex-hook-test-'))
    const git = simpleGit(tmpDir)
    await git.init()
    // Create an initial commit so git is fully initialized
    await writeFile(join(tmpDir, 'README.md'), '# test')
    await git.add('.')
    await git.commit('initial')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('installs hooks in a git repo', async () => {
    await hookInstallCommand({ root: tmpDir })

    const postCommit = join(tmpDir, '.git', 'hooks', 'post-commit')
    const postMerge = join(tmpDir, '.git', 'hooks', 'post-merge')

    expect(existsSync(postCommit)).toBe(true)
    expect(existsSync(postMerge)).toBe(true)

    const content = await readFile(postCommit, 'utf-8')
    expect(content).toContain('#!/bin/sh')
    expect(content).toContain('codecortex-hook-start')
    expect(content).toContain('codecortex update')
    expect(content).toContain('codecortex-hook-end')

    // Check executable permission
    const stats = await stat(postCommit)
    const mode = (stats.mode & 0o777).toString(8)
    expect(mode).toBe('755')
  })

  it('is idempotent — does not duplicate hooks', async () => {
    await hookInstallCommand({ root: tmpDir })
    await hookInstallCommand({ root: tmpDir })

    const content = await readFile(join(tmpDir, '.git', 'hooks', 'post-commit'), 'utf-8')
    const matches = content.match(/codecortex-hook-start/g)
    expect(matches).toHaveLength(1)
  })

  it('appends to existing hooks without overwriting', async () => {
    const hooksDir = join(tmpDir, '.git', 'hooks')
    await mkdir(hooksDir, { recursive: true })
    const existingHook = '#!/bin/bash\necho "existing hook"\n'
    await writeFile(join(hooksDir, 'post-commit'), existingHook, 'utf-8')
    await chmod(join(hooksDir, 'post-commit'), 0o755)

    await hookInstallCommand({ root: tmpDir })

    const content = await readFile(join(hooksDir, 'post-commit'), 'utf-8')
    expect(content).toContain('echo "existing hook"')
    expect(content).toContain('codecortex-hook-start')
    // Preserves original shebang
    expect(content.startsWith('#!/bin/bash')).toBe(true)
  })

  it('uninstalls only CodeCortex section from hooks', async () => {
    const hooksDir = join(tmpDir, '.git', 'hooks')
    await mkdir(hooksDir, { recursive: true })
    const existingHook = '#!/bin/bash\necho "keep me"\n'
    await writeFile(join(hooksDir, 'post-commit'), existingHook, 'utf-8')
    await chmod(join(hooksDir, 'post-commit'), 0o755)

    await hookInstallCommand({ root: tmpDir })
    await hookUninstallCommand({ root: tmpDir })

    const content = await readFile(join(hooksDir, 'post-commit'), 'utf-8')
    expect(content).toContain('echo "keep me"')
    expect(content).not.toContain('codecortex-hook-start')
  })

  it('deletes hook file if only CodeCortex content remains', async () => {
    await hookInstallCommand({ root: tmpDir })
    await hookUninstallCommand({ root: tmpDir })

    expect(existsSync(join(tmpDir, '.git', 'hooks', 'post-commit'))).toBe(false)
    expect(existsSync(join(tmpDir, '.git', 'hooks', 'post-merge'))).toBe(false)
  })

  it('status reports installed/not installed correctly', async () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))

    await hookStatusCommand({ root: tmpDir })
    expect(logs.some(l => l.includes('not installed'))).toBe(true)

    logs.length = 0
    await hookInstallCommand({ root: tmpDir })

    logs.length = 0
    await hookStatusCommand({ root: tmpDir })
    expect(logs.some(l => l.includes('post-commit: installed'))).toBe(true)
    expect(logs.some(l => l.includes('post-merge: installed'))).toBe(true)

    console.log = origLog
  })

  it('errors on non-git directory', async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), 'codecortex-no-git-'))
    let exitCode: number | undefined
    const origExitCode = process.exitCode
    const origError = console.error

    const errors: string[] = []
    console.error = (...args: unknown[]) => errors.push(args.join(' '))

    await hookInstallCommand({ root: nonGitDir })
    exitCode = process.exitCode

    process.exitCode = origExitCode
    console.error = origError

    expect(errors.some(e => e.includes('not a git repository'))).toBe(true)
    expect(exitCode).toBe(1)

    await rm(nonGitDir, { recursive: true, force: true })
  })
})
