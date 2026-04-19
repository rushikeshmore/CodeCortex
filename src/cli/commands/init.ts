import { resolve } from 'node:path'
import { discoverProject, buildModuleNodes } from '../../core/discovery.js'
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
import { writeFile, writeJsonStream, ensureDir, cortexPath } from '../../utils/files.js'
import { readFile } from 'node:fs/promises'
import { generateStructuralModuleDocs } from '../../core/module-gen.js'
import { generateAgentInstructions } from '../../core/agent-instructions.js'
import { generateHotspotsMarkdown } from '../../git/temporal.js'
import { createDecision, writeDecision, listDecisions } from '../../core/decisions.js'
import type { SymbolRecord, ImportEdge, CallEdge, SymbolIndex, ProjectInfo } from '../../types/index.js'

export async function initCommand(opts: { root: string; days: string }): Promise<void> {
  const root = resolve(opts.root)
  const days = parseInt(opts.days, 10)

  console.log(`CodeCortex init — analyzing ${root}`)
  console.log('')

  // Step 1: Discover project
  console.log('Step 1/7: Discovering project structure...')
  const project = await discoverProject(root)
  console.log(`  Found ${project.files.length} files in ${project.modules.length} modules`)
  console.log(`  Languages: ${project.languages.join(', ')}`)
  console.log(`  Type: ${project.type}`)
  console.log('')

  // Step 2: Initialize tree-sitter and extract symbols
  console.log('Step 2/7: Extracting symbols with tree-sitter...')
  await initParser()

  const allSymbols: SymbolRecord[] = []
  const allImports: ImportEdge[] = []
  const allCalls: CallEdge[] = []
  let extractionErrors = 0
  const langStats = new Map<string, { files: number; symbols: number }>()

  let parsed = 0
  const parseable = project.files.filter(f => languageFromPath(f.path)).length
  const showProgress = parseable > 500

  for (const file of project.files) {
    const lang = languageFromPath(file.path)
    if (!lang) continue

    const stats = langStats.get(lang) || { files: 0, symbols: 0 }
    stats.files++

    try {
      const tree = await parseFile(file.absolutePath, lang)
      const source = await readFile(file.absolutePath, 'utf-8')

      const symbols = extractSymbols(tree, file.path, lang, source)
      const imports = extractImports(tree, file.path, lang)
      const calls = extractCalls(tree, file.path, lang)

      stats.symbols += symbols.length
      allSymbols.push(...symbols)
      allImports.push(...imports)
      allCalls.push(...calls)
    } catch {
      extractionErrors++
    }
    langStats.set(lang, stats)
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

  // Warn about languages with 0 symbols extracted
  for (const [lang, stats] of langStats) {
    if (stats.files > 0 && stats.symbols === 0) {
      console.log(`  \u26a0 Warning: ${lang} \u2014 ${stats.files} files parsed, 0 symbols extracted. Grammar may not support this language.`)
    }
  }
  console.log('')

  // Step 3: Build dependency graph
  console.log('Step 3/7: Building dependency graph...')
  const moduleNodes = buildModuleNodes(project.modules, project.files, allSymbols)

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
  console.log('Step 4/7: Analyzing git history...')
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
  console.log('Step 5/7: Writing knowledge files...')
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
  await writeJsonStream(cortexPath(root, 'symbols.json'), symbolIndex, 'symbols')

  // Write graph.json
  await writeGraph(root, graph)

  // Write temporal.json + hotspots.md
  if (temporalData) {
    await writeFile(cortexPath(root, 'temporal.json'), JSON.stringify(temporalData, null, 2))
    await writeFile(cortexPath(root, 'hotspots.md'), generateHotspotsMarkdown(temporalData))
  }

  // Write overview.md — compact summary only (no raw file listing)
  // The constitution + graph.json already contain all the detail an agent needs.
  const overview = generateOverview(project)
  await writeFile(cortexPath(root, 'overview.md'), overview)

  // Write manifest
  const manifest = createManifest({
    project: project.name,
    languages: project.languages,
    totalFiles: project.files.length,
    totalSymbols: allSymbols.length,
    totalModules: project.modules.length,
  })
  await writeManifest(root, manifest)

  // Write patterns.md (empty template)
  await writeFile(cortexPath(root, 'patterns.md'), '# Coding Patterns\n\nNo patterns recorded yet. Edit this file directly to add patterns.\n')

  // Generate structural module docs
  const moduleDocsGenerated = await generateStructuralModuleDocs(root, {
    graph,
    symbols: allSymbols,
    temporal: temporalData,
  })

  console.log(`  Written: cortex.yaml, symbols.json, graph.json, temporal.json, overview.md, patterns.md, ${moduleDocsGenerated} module docs`)
  console.log('')

  // Step 6: Generate constitution
  console.log('Step 6/7: Generating constitution...')
  await generateConstitution(root, {
    modules: moduleNodes,
    entryPoints: project.entryPoints,
    externalDeps,
    temporal: temporalData,
  })
  console.log('  Written: constitution.md')
  console.log('')

  // Step 7: Agent onboarding + inline context injection
  console.log('Step 7/7: Generating inline context...')
  const updatedFiles = await generateAgentInstructions(root)

  // Seed a starter decision (skip if decisions already exist)
  const existingDecisions = await listDecisions(root)
  if (existingDecisions.length === 0) {
    const seedDecision = createDecision({
      title: 'Initialized CodeCortex for codebase knowledge',
      context: 'AI agents need persistent knowledge to avoid re-learning the codebase each session.',
      decision: 'Using CodeCortex to pre-analyze symbols, dependencies, coupling, and patterns.',
      alternatives: ['Manual CLAUDE.md only', 'No codebase context for agents'],
      consequences: ['AI agents start with knowledge', '.codecortex/ added to repo', 'Knowledge needs periodic update via codecortex update'],
    })
    await writeDecision(root, seedDecision)
  }

  console.log(`  Written: ${updatedFiles.join(', ')}`)
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
  console.log('')
  console.log('Connect your AI agent:')
  console.log('  Claude Code:    claude mcp add codecortex -- codecortex serve')
  console.log('  Claude Desktop: Add to claude_desktop_config.json (see README)')
  console.log('  Cursor:         Add to .cursor/mcp.json (see README)')
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
    `## Directory Summary`,
  ]

  // Group files by top-level directory with counts (not raw file listings)
  const topDirs = new Map<string, number>()
  for (const file of project.files) {
    const parts = file.path.split('/')
    const topDir = parts.length > 1 ? parts[0]! : '.'
    topDirs.set(topDir, (topDirs.get(topDir) || 0) + 1)
  }

  for (const [dir, count] of [...topDirs.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${dir}/** — ${count} files`)
  }

  lines.push('')
  lines.push('> For detailed file lists, use `search_knowledge` or `get_dependency_graph` MCP tools.')

  return lines.join('\n') + '\n'
}
