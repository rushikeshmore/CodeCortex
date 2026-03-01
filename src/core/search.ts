import { readFile, listFiles, cortexPath } from '../utils/files.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export interface SearchResult {
  file: string
  line: number
  content: string
  context: string
}

export async function searchKnowledge(projectRoot: string, query: string): Promise<SearchResult[]> {
  const cortexRoot = cortexPath(projectRoot)
  if (!existsSync(cortexRoot)) return []

  const results: SearchResult[] = []
  const queryLower = query.toLowerCase()

  const allFiles = await getAllCortexFiles(cortexRoot)

  for (const filePath of allFiles) {
    const content = await readFile(filePath)
    if (!content) continue

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line?.toLowerCase().includes(queryLower)) {
        // Get surrounding context (2 lines before and after)
        const start = Math.max(0, i - 2)
        const end = Math.min(lines.length - 1, i + 2)
        const context = lines.slice(start, end + 1).join('\n')

        results.push({
          file: filePath.replace(cortexRoot + '/', ''),
          line: i + 1,
          content: line.trim(),
          context,
        })
      }
    }
  }

  return results
}

async function getAllCortexFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  if (!existsSync(dir)) return files

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await getAllCortexFiles(fullPath)
      files.push(...subFiles)
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.json') || entry.name.endsWith('.yaml'))) {
      files.push(fullPath)
    }
  }

  return files
}
