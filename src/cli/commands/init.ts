import { resolve } from 'node:path'
import { discoverProject } from '../../core/discovery.js'
import { createManifest, writeManifest } from '../../core/manifest.js'
import { buildGraph, writeGraph } from '../../core/graph.js'
import { generateConstitution } from '../../core/constitution.js'
import { analyzeTemporalData } from '../../git/temporal.js'
import { isGitRepo, getHeadCommit } from '../../git/history.js'
import { enrichCouplingWithImports } from '../../core/graph.js'
import { initParser, parseFile, languageFromPath } from '../../extraction/parser.js'
import { extractSymbols } from '../../extraction/symbols.js'
import { extractImports } from '../../extraction/imports.js'
import { extractCalls } from '../../extraction/calls.js'
import { writeFile, ensureDir, cortexPath } from '../../utils/files.js'
import { readFile } from 'node:fs/promises'
import type { SymbolRecord, ImportEdge, CallEdge, ModuleNode, SymbolIndex, ProjectInfo } from '../../types/index.js'

export async function initCommand(opts: { root: string; days: string }): Promise<void> {
  const root = resolve(opts.root)
  const days = parseInt(opts.days, 10)

  console.log(`CodeCortex init — analyzing ${root}`)
  console.log('')

  // Step 1: Discover project
  console.log('Step 1/6: Discovering project structure...')
  const project = await discoverProject(root)
  console.log(`  Found ${project.files.length} files in ${project.modules.length} modules`)
  console.log(`  Languages: ${project.languages.join(', ')}`)
  console.log(`  Type: ${project.type}`)
  console.log('')

  // Step 2: Initialize tree-sitter and extract symbols
  console.log('Step 2/6: Extracting symbols with tree-sitter...')
  await initParser()

  const allSymbols: SymbolRecord[] = []
  const allImports: ImportEdge[] = []
  const allCalls: CallEdge[] = []
  let extractionErrors = 0

  const MAX_PARSE_BYTES = 500_000 // 500KB — skip very large files to avoid WASM crashes

  // Sort files by language to avoid V8 WASM OOM — loads one grammar at a time
  const sortedFiles = [...project.files].sort((a, b) => {
    const langA = languageFromPath(a.path) || ''
    const langB = languageFromPath(b.path) || ''
    return langA.localeCompare(langB)
  })

  let parsed = 0
  const parseable = sortedFiles.filter(f => languageFromPath(f.path) && f.bytes <= MAX_PARSE_BYTES).length
  const showProgress = parseable > 500

  for (const file of sortedFiles) {
    const lang = languageFromPath(file.path)
    if (!lang) continue
    if (file.bytes > MAX_PARSE_BYTES) {
      extractionErrors++
      continue
    }

    try {
      const tree = await parseFile(file.absolutePath, lang)
      const source = await readFile(file.absolutePath, 'utf-8')

      const symbols = extractSymbols(tree, file.path, lang, source)
      const imports = extractImports(tree, file.path, lang)
      const calls = extractCalls(tree, file.path, lang)

      allSymbols.push(...symbols)
      allImports.push(...imports)
      allCalls.push(...calls)
    } catch {
      extractionErrors++
    }
    parsed++
    if (showProgress && parsed % 5000 === 0) {
      process.stdout.write(`\r  Progress: ${parsed}/${parseable} files (${allSymbols.length} symbols)`)
    }
  }
  if (showProgress) process.stdout.write('\r' + ' '.repeat(70) + '\r')

  console.log(`  Extracted ${allSymbols.length} symbols, ${allImports.length} imports, ${allCalls.length} call edges`)
  if (extractionErrors > 0) {
    console.log(`  (${extractionErrors} files skipped due to parse errors)`)
  }
  console.log('')

  // Step 3: Build dependency graph
  console.log('Step 3/6: Building dependency graph...')
  const MODULE_ROOTS = new Set(['src', 'lib', 'pkg', 'packages', 'apps', 'extensions', 'crates', 'internal', 'cmd', 'scripts', 'tools', 'rust'])
  const moduleNodes: ModuleNode[] = project.modules.map(modName => {
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

  // Detect external dependencies
  const externalDeps: Record<string, string[]> = {}
  for (const file of project.files) {
    try {
      const content = await readFile(file.absolutePath, 'utf-8')
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

  console.log(`  ${moduleNodes.length} modules, ${Object.keys(externalDeps).length} external deps`)
  console.log('')

  // Step 4: Temporal analysis (git history)
  console.log('Step 4/6: Analyzing git history...')
  let temporalData = null
  const hasGit = await isGitRepo(root)
  if (hasGit) {
    temporalData = await analyzeTemporalData(root, days)
    // Enrich coupling with import graph
    enrichCouplingWithImports(graph, temporalData.coupling)
    console.log(`  ${temporalData.totalCommits} commits analyzed over ${days} days`)
    console.log(`  ${temporalData.hotspots.length} hotspots, ${temporalData.coupling.length} coupling pairs, ${temporalData.bugHistory.length} bug records`)
  } else {
    console.log('  No git repository found, skipping temporal analysis')
  }
  console.log('')

  // Step 5: Write knowledge files
  console.log('Step 5/6: Writing knowledge files...')
  await ensureDir(cortexPath(root))
  await ensureDir(cortexPath(root, 'modules'))
  await ensureDir(cortexPath(root, 'decisions'))
  await ensureDir(cortexPath(root, 'sessions'))

  // Write symbols.json
  const symbolIndex: SymbolIndex = {
    generated: new Date().toISOString(),
    total: allSymbols.length,
    symbols: allSymbols,
  }
  await writeFile(cortexPath(root, 'symbols.json'), JSON.stringify(symbolIndex, null, 2))

  // Write graph.json
  await writeGraph(root, graph)

  // Write temporal.json
  if (temporalData) {
    await writeFile(cortexPath(root, 'temporal.json'), JSON.stringify(temporalData, null, 2))
  }

  // Write overview.md
  const overview = generateOverview(project)
  await writeFile(cortexPath(root, 'overview.md'), overview)

  // Write manifest
  const manifest = createManifest({
    project: project.name,
    root,
    languages: project.languages,
    totalFiles: project.files.length,
    totalSymbols: allSymbols.length,
    totalModules: project.modules.length,
  })
  await writeManifest(root, manifest)

  // Write patterns.md (empty template)
  await writeFile(cortexPath(root, 'patterns.md'), '# Coding Patterns\n\nNo patterns recorded yet. Use `update_patterns` to add patterns.\n')

  console.log('  Written: cortex.yaml, symbols.json, graph.json, temporal.json, overview.md, patterns.md')
  console.log('')

  // Step 6: Generate constitution
  console.log('Step 6/6: Generating constitution...')
  await generateConstitution(root)
  console.log('  Written: constitution.md')
  console.log('')

  // Summary
  const head = await getHeadCommit(root)
  console.log('─'.repeat(50))
  console.log('CodeCortex initialized successfully!')
  console.log('')
  console.log(`  Project: ${project.name}`)
  console.log(`  Files:   ${project.files.length}`)
  console.log(`  Symbols: ${allSymbols.length}`)
  console.log(`  Modules: ${project.modules.length}`)
  if (temporalData) {
    console.log(`  Commits: ${temporalData.totalCommits} (last ${days} days)`)
    const hidden = temporalData.coupling.filter(c => !c.hasImport && c.strength >= 0.5)
    if (hidden.length > 0) {
      console.log(`  Hidden deps: ${hidden.length} (files that co-change but don't import each other)`)
    }
  }
  if (head) {
    console.log(`  Git HEAD: ${head.slice(0, 7)}`)
  }
  console.log('')
  console.log(`Knowledge stored in: ${cortexPath(root)}`)
  console.log('Run `codecortex serve` to start the MCP server.')
}

function generateOverview(project: ProjectInfo): string {
  const lines = [
    `# ${project.name} — Overview`,
    '',
    `**Type:** ${project.type}`,
    `**Languages:** ${project.languages.join(', ')}`,
    `**Files:** ${project.files.length}`,
    '',
    `## Entry Points`,
    ...project.entryPoints.map(e => `- \`${e}\``),
    '',
    `## Modules`,
    ...project.modules.map(m => `- **${m}**`),
    '',
    `## File Map`,
  ]

  // Group files by directory
  const dirs = new Map<string, string[]>()
  for (const file of project.files) {
    const parts = file.path.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    const existing = dirs.get(dir) || []
    const fileName = parts[parts.length - 1]
    if (fileName) existing.push(fileName)
    dirs.set(dir, existing)
  }

  for (const [dir, files] of [...dirs.entries()].sort()) {
    lines.push(`\n### ${dir}/`)
    for (const file of files.sort()) {
      lines.push(`- ${file}`)
    }
  }

  return lines.join('\n') + '\n'
}
