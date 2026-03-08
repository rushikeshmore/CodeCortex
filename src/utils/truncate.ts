/**
 * Response truncation utilities for keeping MCP tool responses context-safe.
 * Every read tool should return < 10K chars on large repos.
 */

export interface TruncatedArray<T> {
  items: T[]
  truncated: boolean
  total: number
  message?: string
}

/** Truncate an array to a max length, with a summary of what was dropped. */
export function truncateArray<T>(arr: T[], limit: number, label: string): TruncatedArray<T> {
  if (arr.length <= limit) {
    return { items: arr, truncated: false, total: arr.length }
  }
  return {
    items: arr.slice(0, limit),
    truncated: true,
    total: arr.length,
    message: `Showing ${limit} of ${arr.length} ${label}. Use filters to narrow results.`,
  }
}

/** Cap a string at a max character length. */
export function capString(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str
  return str.slice(0, maxChars) + '\n\n[truncated — use detail: "full" for complete data]'
}

export interface FileTypeSummary {
  byType: Record<string, { count: number; sample: string[] }>
  total: number
}

/** Group files by type (implementation, tests, types, config) with counts and samples. */
export function summarizeFileList(files: string[]): FileTypeSummary {
  const groups: Record<string, string[]> = {
    tests: [],
    types: [],
    config: [],
    implementation: [],
  }

  for (const file of files) {
    const lower = file.toLowerCase()
    const name = file.split('/').pop() ?? file

    if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__tests__') || lower.startsWith('test/') || lower.startsWith('tests/')) {
      groups['tests']!.push(name)
    } else if (lower.includes('.d.ts') || lower.includes('types') || lower.includes('.type.')) {
      groups['types']!.push(name)
    } else if (lower.includes('.config.') || lower.includes('.json') || lower.includes('.yaml') || lower.includes('.yml') || lower.includes('.toml') || lower.includes('.env')) {
      groups['config']!.push(name)
    } else {
      groups['implementation']!.push(name)
    }
  }

  const byType: Record<string, { count: number; sample: string[] }> = {}
  for (const [type, typeFiles] of Object.entries(groups)) {
    if (typeFiles.length > 0) {
      byType[type] = {
        count: typeFiles.length,
        sample: typeFiles.slice(0, 3),
      }
    }
  }

  return { byType, total: files.length }
}
