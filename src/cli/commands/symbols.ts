import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath, readFile } from '../../utils/files.js'
import type { SymbolIndex } from '../../types/index.js'

export async function symbolsCommand(
  query: string | undefined,
  opts: { root: string; kind?: string; file?: string; exported?: boolean; limit?: string },
): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.log('No CodeCortex knowledge found.')
    console.log(`Run 'codecortex init' to analyze this codebase.`)
    return
  }

  const content = await readFile(cortexPath(root, 'symbols.json'))
  if (!content) {
    console.log('No symbol index found. Run `codecortex init` first.')
    return
  }

  const index: SymbolIndex = JSON.parse(content)

  if (!query && !opts.kind && !opts.file && !opts.exported) {
    // Summary mode
    printSummary(index)
    return
  }

  // Query/filter mode
  let matches = index.symbols

  if (query) {
    const q = query.toLowerCase()
    matches = matches.filter(s => s.name.toLowerCase().includes(q))
  }
  if (opts.kind) {
    matches = matches.filter(s => s.kind === opts.kind)
  }
  if (opts.file) {
    matches = matches.filter(s => s.file.includes(opts.file!))
  }
  if (opts.exported) {
    matches = matches.filter(s => s.exported)
  }

  const limit = parseInt(opts.limit ?? '30', 10)
  const display = matches.slice(0, limit)

  if (display.length === 0) {
    console.log(`No symbols found${query ? ` matching "${query}"` : ''}.`)
    return
  }

  // Print results
  console.log('')
  for (const s of display) {
    const lines = s.endLine > s.startLine ? `${s.startLine}-${s.endLine}` : `${s.startLine}`
    const exp = s.exported ? 'exported' : 'local'
    console.log(`  ${pad(s.kind, 12)} ${pad(s.name, 30)} ${pad(s.file, 40)} ${pad(lines, 10)} ${exp}`)
    if (s.signature) {
      console.log(`${' '.repeat(14)}${s.signature}`)
    }
  }

  console.log('')
  if (matches.length > limit) {
    console.log(`Showing ${limit} of ${matches.length} matches. Use -l to show more.`)
  } else {
    console.log(`${matches.length} symbol${matches.length === 1 ? '' : 's'} found.`)
  }
}

function printSummary(index: SymbolIndex): void {
  console.log('')
  console.log(`Symbol Index: ${index.total} symbols`)
  console.log('─'.repeat(50))

  // Count by kind
  const byKind = new Map<string, number>()
  for (const s of index.symbols) {
    byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1)
  }
  console.log('')
  console.log('By Kind:')
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(kind, 14)} ${count}`)
  }

  // Count by file (top 10)
  const byFile = new Map<string, number>()
  for (const s of index.symbols) {
    byFile.set(s.file, (byFile.get(s.file) ?? 0) + 1)
  }
  console.log('')
  console.log('Top Files:')
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${pad(file, 45)} ${count} symbols`)
  }

  const exported = index.symbols.filter(s => s.exported).length
  console.log('')
  console.log(`Exported: ${exported}/${index.total}`)
  console.log('')
  console.log('Run `codecortex symbols <query>` to search.')
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}
