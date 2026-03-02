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
  // Original 5
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  // Systems
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  objc: 'tree-sitter-objc.wasm',
  zig: 'tree-sitter-zig.wasm',
  // JVM
  java: 'tree-sitter-java.wasm',
  kotlin: 'tree-sitter-kotlin.wasm',
  scala: 'tree-sitter-scala.wasm',
  // .NET
  c_sharp: 'tree-sitter-c_sharp.wasm',
  // Mobile
  swift: 'tree-sitter-swift.wasm',
  dart: 'tree-sitter-dart.wasm',
  // Scripting
  ruby: 'tree-sitter-ruby.wasm',
  php: 'tree-sitter-php.wasm',
  lua: 'tree-sitter-lua.wasm',
  bash: 'tree-sitter-bash.wasm',
  elixir: 'tree-sitter-elixir.wasm',
  // Functional
  ocaml: 'tree-sitter-ocaml.wasm',
  elm: 'tree-sitter-elm.wasm',
  elisp: 'tree-sitter-elisp.wasm',
  rescript: 'tree-sitter-rescript.wasm',
  // Web3 / Other
  solidity: 'tree-sitter-solidity.wasm',
  vue: 'tree-sitter-vue.wasm',
  ql: 'tree-sitter-ql.wasm',
}

export const EXTENSION_MAP: Record<string, string> = {
  // TypeScript / JavaScript
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  // Go
  '.go': 'go',
  // Rust
  '.rs': 'rust',
  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.hh': 'cpp',
  // Objective-C
  '.m': 'objc',
  '.mm': 'objc',
  // Zig
  '.zig': 'zig',
  // Java
  '.java': 'java',
  // Kotlin
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  // Scala
  '.scala': 'scala',
  '.sc': 'scala',
  // C#
  '.cs': 'c_sharp',
  // Swift
  '.swift': 'swift',
  // Dart
  '.dart': 'dart',
  // Ruby
  '.rb': 'ruby',
  '.rake': 'ruby',
  // PHP
  '.php': 'php',
  // Lua
  '.lua': 'lua',
  // Bash / Shell
  '.sh': 'bash',
  '.bash': 'bash',
  // Elixir
  '.ex': 'elixir',
  '.exs': 'elixir',
  // OCaml
  '.ml': 'ocaml',
  '.mli': 'ocaml',
  // Elm
  '.elm': 'elm',
  // Emacs Lisp
  '.el': 'elisp',
  // ReScript
  '.res': 'rescript',
  '.resi': 'rescript',
  // Solidity
  '.sol': 'solidity',
  // Vue
  '.vue': 'vue',
  // CodeQL
  '.ql': 'ql',
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
