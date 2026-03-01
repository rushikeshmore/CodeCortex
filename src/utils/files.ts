import { readFile as fsRead, writeFile as fsWrite, mkdir, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
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

export async function fileSize(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.size
  } catch {
    return 0
  }
}
