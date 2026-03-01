import type { CodingPattern } from '../types/index.js'
import { readFile, writeFile, cortexPath } from '../utils/files.js'
import { generatePatternEntry } from '../utils/markdown.js'

export async function readPatterns(projectRoot: string): Promise<string | null> {
  return readFile(cortexPath(projectRoot, 'patterns.md'))
}

export async function addPattern(projectRoot: string, pattern: CodingPattern): Promise<'added' | 'updated' | 'noop'> {
  const existing = await readPatterns(projectRoot) || '# Coding Patterns\n'

  // Check if pattern with same name already exists
  const nameRegex = new RegExp(`### ${escapeRegex(pattern.name)}`, 'i')
  if (nameRegex.test(existing)) {
    // Update: replace the existing pattern section
    const entry = generatePatternEntry(pattern)
    const sectionRegex = new RegExp(
      `### ${escapeRegex(pattern.name)}[\\s\\S]*?(?=### |$)`,
      'i'
    )
    const updated = existing.replace(sectionRegex, entry + '\n\n')
    await writeFile(cortexPath(projectRoot, 'patterns.md'), updated)
    return 'updated'
  }

  // Add new pattern
  const entry = generatePatternEntry(pattern)
  const content = existing.trimEnd() + '\n\n' + entry + '\n'
  await writeFile(cortexPath(projectRoot, 'patterns.md'), content)
  return 'added'
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
