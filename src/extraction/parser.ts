import { Parser, Language, type Tree } from 'web-tree-sitter'
import { readFile as fsRead } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

let parserReady = false
let parser: Parser

const languageCache = new Map<string, Language>()

const LANGUAGE_MAP: Record<string, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
}

export const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
}

export async function initParser(): Promise<void> {
  if (parserReady) return
  await Parser.init()
  parser = new Parser()
  parserReady = true
}

function findWasmDir(): string {
  const candidates = [
    join(__dirname, '..', '..', 'node_modules', 'tree-sitter-wasms', 'out'),
    join(__dirname, '..', '..', '..', 'node_modules', 'tree-sitter-wasms', 'out'),
    join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  throw new Error('tree-sitter-wasms not found. Run: npm install tree-sitter-wasms')
}

async function loadLanguage(lang: string): Promise<Language> {
  const cached = languageCache.get(lang)
  if (cached) return cached

  const wasmFile = LANGUAGE_MAP[lang]
  if (!wasmFile) throw new Error(`Unsupported language: ${lang}`)

  const wasmDir = findWasmDir()
  const wasmPath = join(wasmDir, wasmFile)

  if (!existsSync(wasmPath)) {
    throw new Error(`WASM grammar not found: ${wasmPath}`)
  }

  const language = await Language.load(wasmPath)
  languageCache.set(lang, language)
  return language
}

export async function parseFile(filePath: string, language: string): Promise<Tree> {
  await initParser()
  const lang = await loadLanguage(language)
  parser.setLanguage(lang)
  const source = await fsRead(filePath, 'utf-8')
  return parser.parse(source) as Tree
}

export async function parseSource(source: string, language: string): Promise<Tree> {
  await initParser()
  const lang = await loadLanguage(language)
  parser.setLanguage(lang)
  return parser.parse(source) as Tree
}

export function languageFromPath(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'))
  return EXTENSION_MAP[ext] || null
}

export function supportedLanguages(): string[] {
  return Object.keys(LANGUAGE_MAP)
}

// Re-export types for consumers
export type { Tree, Language }
export { Parser }
export type TreeSitterNode = import('web-tree-sitter').Node
