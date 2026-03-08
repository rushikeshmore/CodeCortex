import { readFile, cortexPath } from '../utils/files.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { SymbolIndex, DependencyGraph } from '../types/index.js'

export interface SearchResult {
  file: string
  line: number
  content: string
  context: string
  type: 'symbol' | 'file' | 'doc'
  score: number
  kind?: string
  signature?: string
}

/**
 * Unified search across symbols, file paths, and knowledge docs.
 *
 * Scoring:
 *   Symbols: base (exact=10, prefix=5, contains=3) + kind bonus + export bonus
 *     Kind bonus: function/class/interface/type/enum = +2, method = +1, const/variable/property = 0
 *     Export bonus: exported = +1
 *   File paths: 4
 *   Docs: 2
 *
 * Multi-word queries: splits on spaces and matches ALL words (AND logic).
 */
export async function searchKnowledge(
  projectRoot: string,
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  const cortexRoot = cortexPath(projectRoot)
  if (!existsSync(cortexRoot) || !query.trim()) return []

  const queryLower = query.toLowerCase().trim()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0)
  const results: SearchResult[] = []

  // 1. Search symbols
  const symbolResults = await searchSymbols(cortexRoot, queryLower, queryWords)
  results.push(...symbolResults)

  // 2. Search file paths from graph
  const fileResults = await searchFilePaths(cortexRoot, queryLower, queryWords)
  results.push(...fileResults)

  // 3. Search markdown knowledge docs
  const docResults = await searchDocs(cortexRoot, queryLower, queryWords)
  results.push(...docResults)

  // Deduplicate by file+line, keeping highest score
  const seen = new Map<string, SearchResult>()
  for (const r of results) {
    const key = `${r.file}:${r.line}`
    const existing = seen.get(key)
    if (!existing || r.score > existing.score) {
      seen.set(key, r)
    }
  }

  // Sort by score desc, slice to limit
  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Definition-level symbols score higher than local variables
const HIGH_VALUE_KINDS = new Set(['function', 'class', 'interface', 'type', 'enum'])
const MID_VALUE_KINDS = new Set(['method'])

async function searchSymbols(cortexRoot: string, queryLower: string, queryWords: string[]): Promise<SearchResult[]> {
  const content = await readFile(join(cortexRoot, 'symbols.json'))
  if (!content) return []

  let index: SymbolIndex
  try {
    index = JSON.parse(content) as SymbolIndex
  } catch {
    return []
  }

  const results: SearchResult[] = []

  for (const sym of index.symbols) {
    const nameLower = sym.name.toLowerCase()
    // Also search the file path for multi-word queries (e.g. "gateway reconnect")
    const fileLower = sym.file.toLowerCase()

    let baseScore = 0

    if (queryWords.length > 1) {
      // Multi-word: check if ALL words match across name + file path
      const searchable = `${nameLower} ${fileLower}`
      const allMatch = queryWords.every(w => searchable.includes(w))
      if (!allMatch) continue

      // Score based on how many words hit the symbol name vs just file path
      const nameHits = queryWords.filter(w => nameLower.includes(w)).length
      if (nameHits === queryWords.length) {
        baseScore = 10 // all words in name
      } else if (nameHits > 0) {
        baseScore = 6 // some in name, rest in file
      } else {
        baseScore = 3 // all in file path only
      }
    } else {
      // Single word: exact > prefix > contains
      if (nameLower === queryLower) {
        baseScore = 10
      } else if (nameLower.startsWith(queryLower)) {
        baseScore = 5
      } else if (nameLower.includes(queryLower)) {
        baseScore = 3
      }
    }

    if (baseScore === 0) continue

    // Non-exported const/variable exact matches are usually local variable assignments
    // (e.g. `const auth = resolveAuth(...)`) — cap them so definitions rank higher
    const isLocalVar = !sym.exported && (sym.kind === 'const' || sym.kind === 'variable')
    if (isLocalVar && baseScore === 10) {
      baseScore = 5 // demote to same as prefix match
    }

    // Kind bonus: definitions > local variables
    let kindBonus = 0
    if (HIGH_VALUE_KINDS.has(sym.kind)) kindBonus = 2
    else if (MID_VALUE_KINDS.has(sym.kind)) kindBonus = 1

    // Export bonus: exported symbols are more useful
    const exportBonus = sym.exported ? 1 : 0

    const score = baseScore + kindBonus + exportBonus

    results.push({
      file: sym.file,
      line: sym.startLine,
      content: sym.signature ?? `${sym.kind} ${sym.name}`,
      context: `${sym.exported ? 'export ' : ''}${sym.kind} ${sym.name} — ${sym.file}:${sym.startLine}`,
      type: 'symbol',
      score,
      kind: sym.kind,
      signature: sym.signature,
    })
  }

  return results
}

async function searchFilePaths(cortexRoot: string, queryLower: string, queryWords: string[]): Promise<SearchResult[]> {
  const content = await readFile(join(cortexRoot, 'graph.json'))
  if (!content) return []

  let graph: DependencyGraph
  try {
    graph = JSON.parse(content) as DependencyGraph
  } catch {
    return []
  }

  const results: SearchResult[] = []
  const seen = new Set<string>()

  // Collect all unique file paths from modules
  for (const mod of graph.modules) {
    for (const file of mod.files) {
      if (seen.has(file)) continue
      const fileLower = file.toLowerCase()

      const matches = queryWords.length > 1
        ? queryWords.every(w => fileLower.includes(w))
        : fileLower.includes(queryLower)

      if (matches) {
        seen.add(file)
        results.push({
          file,
          line: 1,
          content: file,
          context: `File in module "${mod.name}" (${mod.language})`,
          type: 'file',
          score: 4,
        })
      }
    }
  }

  return results
}

async function searchDocs(cortexRoot: string, queryLower: string, queryWords: string[]): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const mdFiles = await getMarkdownFiles(cortexRoot)

  for (const filePath of mdFiles) {
    const content = await readFile(filePath)
    if (!content) continue

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const lineLower = line.toLowerCase()

      const matches = queryWords.length > 1
        ? queryWords.every(w => lineLower.includes(w))
        : lineLower.includes(queryLower)

      if (matches) {
        const start = Math.max(0, i - 2)
        const end = Math.min(lines.length - 1, i + 2)
        const context = lines.slice(start, end + 1).join('\n')

        results.push({
          file: filePath.replace(cortexRoot + '/', ''),
          line: i + 1,
          content: line.trim(),
          context,
          type: 'doc',
          score: 2,
        })
      }
    }
  }

  return results
}

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  if (!existsSync(dir)) return files

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await getMarkdownFiles(fullPath)
      files.push(...subFiles)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}
