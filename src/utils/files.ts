import { readFile as fsRead, writeFile as fsWrite, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'

export async function readFile(path: string): Promise<string | null> {
  try {
    return await fsRead(path, 'utf-8')
  } catch {
    return null
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path))
  await fsWrite(path, content, 'utf-8')
}

export async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function listFiles(dir: string, extension?: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!extension || entry.name.endsWith(extension)) {
        files.push(join(dir, entry.name))
      }
    }
  }
  return files
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export function cortexDir(projectRoot: string): string {
  return join(projectRoot, '.codecortex')
}

export function cortexPath(projectRoot: string, ...segments: string[]): string {
  return join(projectRoot, '.codecortex', ...segments)
}

export async function countLines(path: string): Promise<number> {
  const content = await readFile(path)
  if (!content) return 0
  return content.split('\n').length
}

/** Stream-write a large array-based JSON object to avoid V8 string length limits. */
export async function writeJsonStream<T extends object>(path: string, obj: T, arrayKey: string & keyof T): Promise<void> {
  await ensureDir(dirname(path))
  const arr = obj[arrayKey] as unknown[]
  const stream = createWriteStream(path)
  stream.setMaxListeners(0)

  // Single error handler for the entire operation
  let streamError: Error | null = null
  stream.on('error', (err) => { streamError = err })

  function waitDrain(): Promise<void> {
    return new Promise((resolve) => stream.once('drain', resolve))
  }

  // Write non-array fields as header
  const header: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k !== arrayKey) header[k] = v
  }
  const headerJson = JSON.stringify(header)
  stream.write(headerJson.slice(0, -1) + `,"${arrayKey}":[`)

  // Write array elements in batches to reduce await overhead
  const BATCH_SIZE = 1000
  for (let i = 0; i < arr.length; i += BATCH_SIZE) {
    if (streamError) throw streamError
    const end = Math.min(i + BATCH_SIZE, arr.length)
    const chunks: string[] = []
    for (let j = i; j < end; j++) {
      chunks.push((j > 0 ? ',' : '') + JSON.stringify(arr[j]))
    }
    if (!stream.write(chunks.join(''))) {
      await waitDrain()
    }
  }

  stream.write(']}')

  return new Promise((resolve, reject) => {
    if (streamError) { reject(streamError); return }
    stream.on('finish', resolve)
    stream.on('error', reject)
    stream.end()
  })
}

export async function fileSize(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.size
  } catch {
    return 0
  }
}
