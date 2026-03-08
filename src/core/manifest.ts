import type { CortexManifest } from '../types/index.js'
import { readFile, writeFile, cortexPath } from '../utils/files.js'
import { parseYaml, stringifyYaml } from '../utils/yaml.js'
import { classifyProject } from './project-size.js'

export async function readManifest(projectRoot: string): Promise<CortexManifest | null> {
  const content = await readFile(cortexPath(projectRoot, 'cortex.yaml'))
  if (!content) return null
  return parseYaml<CortexManifest>(content)
}

export async function writeManifest(projectRoot: string, manifest: CortexManifest): Promise<void> {
  const content = stringifyYaml(manifest)
  await writeFile(cortexPath(projectRoot, 'cortex.yaml'), content)
}

export function createManifest(opts: {
  project: string
  root: string
  languages: string[]
  totalFiles: number
  totalSymbols: number
  totalModules: number
}): CortexManifest {
  const now = new Date().toISOString()
  return {
    version: '1.0.0',
    project: opts.project,
    root: opts.root,
    generated: now,
    lastUpdated: now,
    languages: opts.languages,
    totalFiles: opts.totalFiles,
    totalSymbols: opts.totalSymbols,
    totalModules: opts.totalModules,
    projectSize: classifyProject(opts.totalFiles, opts.totalSymbols, opts.totalModules),
    tiers: {
      hot: ['cortex.yaml', 'constitution.md', 'overview.md', 'graph.json', 'symbols.json', 'temporal.json'],
      warm: ['modules/'],
      cold: ['decisions/', 'sessions/', 'patterns.md'],
    },
  }
}

export async function updateManifest(
  projectRoot: string,
  updates: Partial<Pick<CortexManifest, 'totalFiles' | 'totalSymbols' | 'totalModules' | 'languages'>>
): Promise<CortexManifest | null> {
  const manifest = await readManifest(projectRoot)
  if (!manifest) return null

  const merged = { ...manifest, ...updates }
  const updated: CortexManifest = {
    ...merged,
    lastUpdated: new Date().toISOString(),
    projectSize: classifyProject(merged.totalFiles, merged.totalSymbols, merged.totalModules),
  }

  await writeManifest(projectRoot, updated)
  return updated
}
