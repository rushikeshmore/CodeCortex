import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath, readFile, writeFile, writeJsonStream } from '../../utils/files.js'
import { readManifest, updateManifest } from '../../core/manifest.js'
import { discoverProject } from '../../core/discovery.js'
import { analyzeTemporalData } from '../../git/temporal.js'
import { isGitRepo } from '../../git/history.js'
import { getUncommittedDiff } from '../../git/diff.js'
import { mapFilesToModules } from '../../git/diff.js'
import { initParser, parseFile, languageFromPath } from '../../extraction/parser.js'
import { extractSymbols } from '../../extraction/symbols.js'
import { extractImports } from '../../extraction/imports.js'
import { extractCalls } from '../../extraction/calls.js'
import { buildGraph, writeGraph, enrichCouplingWithImports } from '../../core/graph.js'
import { generateConstitution } from '../../core/constitution.js'
import { createSession, writeSession, getLatestSession } from '../../core/sessions.js'
import { readFile as fsRead } from 'node:fs/promises'
import { generateStructuralModuleDocs } from '../../core/module-gen.js'
import type { SymbolRecord, ImportEdge, CallEdge, SymbolIndex } from '../../types/index.js'

export async function updateCommand(opts: { root: string; days: string }): Promise<void> {
  const root = resolve(opts.root)
  const days = parseInt(opts.days, 10)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.error('Error: No CodeCortex knowledge found. Run `codecortex init` first.')
    process.exit(1)
  }

  console.log('CodeCortex update — refreshing knowledge...')
  console.log('')

  // Discover current state
  console.log('Discovering changes...')
  const project = await discoverProject(root)

  // Re-extract all symbols (full refresh for now, incremental in v2)
  console.log('Re-extracting symbols...')
  await initParser()

  const allSymbols: SymbolRecord[] = []
  const allImports: ImportEdge[] = []
  const allCalls: CallEdge[] = []

  for (const file of project.files) {
    const lang = languageFromPath(file.path)
    if (!lang) continue
    try {
      const tree = await parseFile(file.absolutePath, lang)
      const source = await fsRead(file.absolutePath, 'utf-8')
      allSymbols.push(...extractSymbols(tree, file.path, lang, source))
      allImports.push(...extractImports(tree, file.path, lang))
      allCalls.push(...extractCalls(tree, file.path, lang))
    } catch { /* skip */ }
  }

  // Rebuild graph
  console.log('Rebuilding dependency graph...')
  const MODULE_ROOTS = new Set(['src', 'lib', 'pkg', 'packages', 'apps', 'extensions', 'crates', 'internal', 'cmd', 'scripts', 'tools', 'rust'])
  const moduleNodes = project.modules.map(modName => {
    const modFiles = project.files.filter(f => {
      const parts = f.path.split('/')
      const topDir = parts[0] ?? ''
      return (MODULE_ROOTS.has(topDir) && parts[1] === modName) ||
             (parts[0] === modName)
    })
    const topDir = modFiles[0]?.path.split('/')[0] ?? 'src'
    return {
      path: `${topDir}/${modName}`,
      name: modName,
      files: modFiles.map(f => f.path),
      language: modFiles[0]?.language || 'unknown',
      lines: modFiles.reduce((sum, f) => sum + f.lines, 0),
      symbols: allSymbols.filter(s => modFiles.some(f => f.path === s.file)).length,
    }
  })

  const externalDeps: Record<string, string[]> = {}
  for (const file of project.files) {
    try {
      const content = await fsRead(file.absolutePath, 'utf-8')
      const importMatches = content.matchAll(/from\s+['"]([^.\/][^'"]*)['"]/g)
      for (const match of importMatches) {
        const raw = match[1]
        if (!raw) continue
        const pkg = raw.startsWith('@') ? raw.split('/').slice(0, 2).join('/') : raw.split('/')[0] ?? raw
        if (!externalDeps[pkg]) externalDeps[pkg] = []
        externalDeps[pkg]!.push(file.path)
      }
    } catch { /* skip */ }
  }

  const graph = buildGraph({
    modules: moduleNodes,
    imports: allImports,
    calls: allCalls,
    entryPoints: project.entryPoints,
    externalDeps,
  })

  // Re-analyze temporal data
  console.log('Re-analyzing git history...')
  let temporalData = null
  if (await isGitRepo(root)) {
    temporalData = await analyzeTemporalData(root, days)
    enrichCouplingWithImports(graph, temporalData.coupling)
  }

  // Write updated files
  console.log('Writing updated knowledge...')
  const symbolIndex: SymbolIndex = {
    generated: new Date().toISOString(),
    total: allSymbols.length,
    symbols: allSymbols,
  }
  await writeJsonStream(cortexPath(root, 'symbols.json'), symbolIndex, 'symbols')
  await writeGraph(root, graph)
  if (temporalData) {
    await writeFile(cortexPath(root, 'temporal.json'), JSON.stringify(temporalData, null, 2))
  }

  // Generate structural module docs (skip existing)
  await generateStructuralModuleDocs(root, {
    graph,
    symbols: allSymbols,
    temporal: temporalData,
  })

  // Update manifest
  await updateManifest(root, {
    totalFiles: project.files.length,
    totalSymbols: allSymbols.length,
    totalModules: project.modules.length,
    languages: project.languages,
  })

  // Regenerate constitution
  await generateConstitution(root, {
    modules: moduleNodes,
    entryPoints: project.entryPoints,
    externalDeps,
    temporal: temporalData,
  })

  // Create session log
  const diff = await getUncommittedDiff(root).catch(() => ({ filesChanged: [], summary: 'no changes' }))
  const previousSession = await getLatestSession(root)
  const affectedModules = [...mapFilesToModules(diff.filesChanged).keys()]
  const session = createSession({
    filesChanged: diff.filesChanged,
    modulesAffected: affectedModules,
    summary: `Updated knowledge. ${allSymbols.length} symbols, ${project.modules.length} modules.`,
    previousSession: previousSession || undefined,
  })
  await writeSession(root, session)

  console.log('')
  console.log('─'.repeat(50))
  console.log('Update complete!')
  console.log(`  Symbols: ${allSymbols.length}`)
  console.log(`  Modules: ${project.modules.length}`)
  if (temporalData) {
    console.log(`  Commits: ${temporalData.totalCommits}`)
  }
  console.log(`  Session: ${session.id}`)
}
