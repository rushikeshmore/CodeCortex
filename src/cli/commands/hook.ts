import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, writeFile, stat, chmod, unlink } from 'node:fs/promises'
import simpleGit from 'simple-git'
import { isGitRepo } from '../../git/history.js'
import { readManifest } from '../../core/manifest.js'

const HOOK_START = '# --- codecortex-hook-start ---'
const HOOK_END = '# --- codecortex-hook-end ---'
const HOOK_TYPES = ['post-commit', 'post-merge'] as const

const HOOK_SCRIPT = `
${HOOK_START}
# Auto-update CodeCortex knowledge after git operations
# Installed by: codecortex hook install
(
  if command -v codecortex >/dev/null 2>&1; then
    codecortex update >/dev/null 2>&1
  elif command -v npx >/dev/null 2>&1; then
    npx codecortex-ai update >/dev/null 2>&1
  fi
) &
${HOOK_END}
`.trimStart()

// --- Pure helpers ---

export function hasCodeCortexHook(content: string): boolean {
  return content.includes(HOOK_START)
}

export function removeCodeCortexHook(content: string): string {
  const startIdx = content.indexOf(HOOK_START)
  if (startIdx === -1) return content
  const endIdx = content.indexOf(HOOK_END)
  if (endIdx === -1) return content

  const before = content.slice(0, startIdx)
  const after = content.slice(endIdx + HOOK_END.length)

  // Remove trailing newline left by the section
  return before + after.replace(/^\n/, '')
}

export function isEmptyHook(content: string): boolean {
  const stripped = content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      return trimmed !== '' && !trimmed.startsWith('#!') && !trimmed.startsWith('#')
    })
    .join('')
  return stripped.length === 0
}

// --- Git hooks dir resolution ---

async function getGitHooksDir(root: string): Promise<string> {
  const git = simpleGit(root)
  const gitDir = (await git.revparse(['--git-dir'])).trim()
  const resolved = resolve(root, gitDir)
  return join(resolved, 'hooks')
}

// --- .gitignore check ---

async function isCodeCortexIgnored(root: string): Promise<boolean> {
  const gitignorePath = join(root, '.gitignore')
  if (!existsSync(gitignorePath)) return false
  try {
    const content = await readFile(gitignorePath, 'utf-8')
    return content.split('\n').some(line => {
      const trimmed = line.trim()
      return trimmed === '.codecortex' || trimmed === '.codecortex/' || trimmed === '.codecortex/**'
    })
  } catch {
    return false
  }
}

// --- Commands ---

export async function hookInstallCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  if (!(await isGitRepo(root))) {
    console.error('Error: not a git repository.')
    process.exitCode = 1
    return
  }

  if (process.platform === 'win32') {
    console.warn('Warning: shell-based git hooks may not work natively on Windows.')
    console.warn('Consider using WSL or Git Bash.')
  }

  const hooksDir = await getGitHooksDir(root)

  // Warn if .codecortex is gitignored
  if (await isCodeCortexIgnored(root)) {
    console.warn("Warning: .codecortex is in .gitignore — knowledge won't be shared.")
    console.warn('Remove .codecortex from .gitignore to commit it alongside code.')
    console.log('')
  }

  for (const hookType of HOOK_TYPES) {
    const hookPath = join(hooksDir, hookType)
    let status: string

    if (existsSync(hookPath)) {
      const content = await readFile(hookPath, 'utf-8')
      if (hasCodeCortexHook(content)) {
        status = 'already installed'
      } else {
        // Append to existing hook
        const newContent = content.trimEnd() + '\n\n' + HOOK_SCRIPT
        await writeFile(hookPath, newContent, 'utf-8')
        await chmod(hookPath, 0o755)
        status = 'installed'
      }
    } else {
      // Create new hook file
      const content = '#!/bin/sh\n\n' + HOOK_SCRIPT
      await writeFile(hookPath, content, 'utf-8')
      await chmod(hookPath, 0o755)
      status = 'installed'
    }

    console.log(`  ${hookType}: ${status}`)
  }

  const allNew = true // If we got here, hooks are installed
  console.log('')
  console.log('Knowledge will auto-update after every commit and merge.')
}

export async function hookUninstallCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  if (!(await isGitRepo(root))) {
    console.error('Error: not a git repository.')
    process.exitCode = 1
    return
  }

  const hooksDir = await getGitHooksDir(root)

  for (const hookType of HOOK_TYPES) {
    const hookPath = join(hooksDir, hookType)
    let status: string

    if (!existsSync(hookPath)) {
      status = 'not installed'
    } else {
      const content = await readFile(hookPath, 'utf-8')
      if (!hasCodeCortexHook(content)) {
        status = 'not installed'
      } else {
        const cleaned = removeCodeCortexHook(content)
        if (isEmptyHook(cleaned)) {
          await unlink(hookPath)
        } else {
          await writeFile(hookPath, cleaned, 'utf-8')
        }
        status = 'removed'
      }
    }

    console.log(`  ${hookType}: ${status}`)
  }
}

export async function hookStatusCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  if (!(await isGitRepo(root))) {
    console.error('Error: not a git repository.')
    process.exitCode = 1
    return
  }

  const hooksDir = await getGitHooksDir(root)

  for (const hookType of HOOK_TYPES) {
    const hookPath = join(hooksDir, hookType)
    let installed = false

    if (existsSync(hookPath)) {
      const content = await readFile(hookPath, 'utf-8')
      installed = hasCodeCortexHook(content)
    }

    console.log(`  ${hookType}: ${installed ? 'installed' : 'not installed'}`)
  }

  // Knowledge freshness
  const manifest = await readManifest(root)
  if (manifest) {
    const lastUpdated = new Date(manifest.lastUpdated)
    const ageHours = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60))
    const ageLabel = ageHours < 1 ? 'just now' :
      ageHours < 24 ? `${ageHours} hour${ageHours === 1 ? '' : 's'} ago` :
      `${Math.floor(ageHours / 24)} day${Math.floor(ageHours / 24) === 1 ? '' : 's'} ago`
    console.log(`  Knowledge: last updated ${ageLabel}`)
  } else {
    console.log('  Knowledge: not initialized (run codecortex init)')
  }
}
