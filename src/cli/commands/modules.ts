import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath } from '../../utils/files.js'
import { readGraph, getModuleDependencies } from '../../core/graph.js'
import { readModuleDoc, listModuleDocs } from '../../core/modules.js'

export async function modulesCommand(
  name: string | undefined,
  opts: { root: string },
): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.log('No CodeCortex knowledge found.')
    console.log(`Run 'codecortex init' to analyze this codebase.`)
    return
  }

  const graph = await readGraph(root)
  if (!graph) {
    console.log('No dependency graph found. Run `codecortex init` first.')
    return
  }

  if (!name) {
    await printModuleList(root, graph)
    return
  }

  await printModuleDetail(root, name, graph)
}

async function printModuleList(
  root: string,
  graph: import('../../types/index.js').DependencyGraph,
): Promise<void> {
  const docsAvailable = new Set(await listModuleDocs(root))

  console.log('')
  console.log(`Modules: ${graph.modules.length}`)
  console.log('─'.repeat(70))
  console.log('')
  console.log(`  ${pad('MODULE', 18)} ${pad('FILES', 6)} ${pad('LINES', 7)} ${pad('SYMBOLS', 8)} ${pad('LANG', 14)} DOC`)

  for (const mod of [...graph.modules].sort((a, b) => a.name.localeCompare(b.name))) {
    const hasDoc = docsAvailable.has(mod.name) ? 'yes' : '--'
    console.log(`  ${pad(mod.name, 18)} ${pad(String(mod.files.length), 6)} ${pad(String(mod.lines), 7)} ${pad(String(mod.symbols), 8)} ${pad(mod.language, 14)} ${hasDoc}`)
  }

  const withDocs = graph.modules.filter(m => docsAvailable.has(m.name)).length
  console.log('')
  console.log(`${graph.modules.length} modules, ${withDocs} with docs.`)
  console.log('')
  console.log('Run `codecortex modules <name>` to deep-dive into a module.')
}

async function printModuleDetail(
  root: string,
  name: string,
  graph: import('../../types/index.js').DependencyGraph,
): Promise<void> {
  const mod = graph.modules.find(m => m.name === name)
  if (!mod) {
    const available = graph.modules.map(m => m.name).join(', ')
    console.log(`Module "${name}" not found. Available: ${available}`)
    return
  }

  console.log('')
  console.log(`Module: ${name}`)
  console.log('═'.repeat(50))

  // Module doc
  const doc = await readModuleDoc(root, name)
  if (doc) {
    console.log('')
    console.log(doc)
  } else {
    console.log('')
    console.log(`No module doc for "${name}".`)
    console.log(`Run \`codecortex init\` to generate structural docs.`)
  }

  // Dependencies
  const deps = getModuleDependencies(graph, name)

  if (deps.imports.length > 0) {
    console.log('')
    console.log('Imports:')
    const seen = new Set<string>()
    for (const edge of deps.imports) {
      const key = `${edge.source} -> ${edge.target}`
      if (seen.has(key)) continue
      seen.add(key)
      const specifiers = edge.specifiers.length > 0 ? ` [${edge.specifiers.join(', ')}]` : ''
      console.log(`  ${edge.source} -> ${edge.target}${specifiers}`)
    }
  }

  if (deps.importedBy.length > 0) {
    console.log('')
    console.log('Imported By:')
    const seen = new Set<string>()
    for (const edge of deps.importedBy) {
      const key = `${edge.source} -> ${edge.target}`
      if (seen.has(key)) continue
      seen.add(key)
      const specifiers = edge.specifiers.length > 0 ? ` [${edge.specifiers.join(', ')}]` : ''
      console.log(`  ${edge.source} -> ${edge.target}${specifiers}`)
    }
  }

  console.log('')
  console.log(`Stats: ${mod.files.length} files, ${mod.lines} lines, ${mod.symbols} symbols (${mod.language})`)
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
