import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath } from '../../utils/files.js'
import { searchKnowledge } from '../../core/search.js'

export async function searchCommand(
  query: string,
  opts: { root: string; limit?: string },
): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.log('No CodeCortex knowledge found.')
    console.log(`Run 'codecortex init' to analyze this codebase.`)
    return
  }

  const results = await searchKnowledge(root, query)
  const limit = parseInt(opts.limit ?? '20', 10)
  const display = results.slice(0, limit)

  if (display.length === 0) {
    console.log(`No results for "${query}".`)
    return
  }

  console.log('')
  console.log(`Search: "${query}"`)
  console.log('─'.repeat(50))

  for (let i = 0; i < display.length; i++) {
    const r = display[i]!
    console.log('')
    console.log(`  [${i + 1}] ${r.file}:${r.line}`)

    // Print context lines, highlight the match
    const ctxLines = r.context.split('\n')
    for (const line of ctxLines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.toLowerCase().includes(query.toLowerCase())) {
        console.log(`    > ${trimmed}`)
      } else {
        console.log(`      ${trimmed}`)
      }
    }
  }

  console.log('')
  if (results.length > limit) {
    console.log(`Showing ${limit} of ${results.length} results. Use -l to show more.`)
  } else {
    console.log(`${results.length} result${results.length === 1 ? '' : 's'} found.`)
  }
}
