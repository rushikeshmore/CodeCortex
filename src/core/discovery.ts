import { execSync } from 'node:child_process'
import { readFile as fsRead, stat } from 'node:fs/promises'
import { join, relative, dirname, basename, extname } from 'node:path'
import { existsSync } from 'node:fs'
import type { DiscoveredFile, ProjectInfo } from '../types/index.js'
import { EXTENSION_MAP } from '../extraction/parser.js'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '.output', 'coverage', '__pycache__', '.mypy_cache', '.pytest_cache',
  'vendor', 'target', '.codecortex',
])

const IGNORED_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db',
])

export async function discoverProject(root: string): Promise<ProjectInfo> {
  const name = detectProjectName(root)
  const type = detectProjectType(root)
  const files = await discoverFiles(root)
  const modules = detectModules(root, files)
  const entryPoints = detectEntryPoints(root, files, type)
  const languages = [...new Set(files.map(f => f.language).filter(Boolean))]

  return { name, root, type, files, modules, entryPoints, languages }
}

function detectProjectName(root: string): string {
  // Try package.json
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(execSync(`cat "${pkgPath}"`, { encoding: 'utf-8' }))
      if (pkg.name) return pkg.name
    } catch { /* ignore */ }
  }

  // Try Cargo.toml
  const cargoPath = join(root, 'Cargo.toml')
  if (existsSync(cargoPath)) {
    try {
      const cargo = execSync(`cat "${cargoPath}"`, { encoding: 'utf-8' })
      const match = cargo.match(/name\s*=\s*"(.+?)"/)
      if (match?.[1]) return match[1]
    } catch { /* ignore */ }
  }

  // Fallback to directory name
  return basename(root)
}

function detectProjectType(root: string): ProjectInfo['type'] {
  if (existsSync(join(root, 'package.json'))) return 'node'
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'setup.py')) || existsSync(join(root, 'requirements.txt'))) return 'python'
  if (existsSync(join(root, 'go.mod'))) return 'go'
  if (existsSync(join(root, 'Cargo.toml'))) return 'rust'
  return 'unknown'
}

async function discoverFiles(root: string): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = []

  // Use git ls-files if in a git repo (respects .gitignore)
  let filePaths: string[]
  try {
    const output = execSync('git ls-files --cached --others --exclude-standard', {
      cwd: root,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    })
    filePaths = output.trim().split('\n').filter(Boolean)
  } catch {
    // Fallback: walk manually
    filePaths = await walkDirectory(root, root)
  }

  for (const relPath of filePaths) {
    const ext = extname(relPath)
    const language = EXTENSION_MAP[ext]
    if (!language) continue

    // Skip ignored dirs and files
    const parts = relPath.split('/')
    if (parts.some(p => IGNORED_DIRS.has(p))) continue
    if (IGNORED_FILES.has(basename(relPath))) continue

    const absPath = join(root, relPath)
    try {
      const s = await stat(absPath)
      const content = await fsRead(absPath, 'utf-8')
      const lines = content.split('\n').length

      files.push({
        path: relPath,
        absolutePath: absPath,
        language,
        lines,
        bytes: s.size,
      })
    } catch {
      // Skip files that can't be read
    }
  }

  return files
}

async function walkDirectory(root: string, baseRoot: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const paths: string[] = []

  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    if (IGNORED_FILES.has(entry.name)) continue

    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      const sub = await walkDirectory(fullPath, baseRoot)
      paths.push(...sub)
    } else if (entry.isFile()) {
      paths.push(relative(baseRoot, fullPath))
    }
  }

  return paths
}

function detectModules(root: string, files: DiscoveredFile[]): string[] {
  // Detect top-level directories under src/ (or equivalent)
  const srcDirs = new Set<string>()

  for (const file of files) {
    const parts = file.path.split('/')
    if (parts.length >= 2) {
      const dir = parts[1]
      if (!dir) continue

      // src/scoring/compute.ts → "scoring"
      if (parts[0] === 'src' && parts.length >= 3) {
        srcDirs.add(dir)
      }
      // lib/scoring/compute.ts → "scoring"
      else if (parts[0] === 'lib' && parts.length >= 3) {
        srcDirs.add(dir)
      }
      // pkg/scoring/compute.ts → "scoring" (Go style)
      else if (parts[0] === 'pkg' && parts.length >= 3) {
        srcDirs.add(dir)
      }
    }
  }

  return [...srcDirs].sort()
}

function detectEntryPoints(root: string, files: DiscoveredFile[], type: ProjectInfo['type']): string[] {
  const entryPoints: string[] = []

  // Check package.json for main/bin entries
  if (type === 'node') {
    const pkgPath = join(root, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(execSync(`cat "${pkgPath}"`, { encoding: 'utf-8' }))
        if (pkg.main) entryPoints.push(pkg.main)
        if (pkg.bin) {
          const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin)
          entryPoints.push(...(bins as string[]))
        }
      } catch { /* ignore */ }
    }
  }

  // Common entry point file names
  const commonEntries = ['src/index.ts', 'src/main.ts', 'src/app.ts', 'index.ts', 'main.ts', 'main.go', 'src/main.rs', 'src/lib.rs']
  for (const entry of commonEntries) {
    if (files.some(f => f.path === entry)) {
      if (!entryPoints.includes(entry)) entryPoints.push(entry)
    }
  }

  return entryPoints
}
