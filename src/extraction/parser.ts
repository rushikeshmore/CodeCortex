import { createRequire } from 'node:module'
import { readFile as fsRead } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const Parser = require('tree-sitter') as typeof import('tree-sitter')

// Re-export types for consumers
export type Tree = import('tree-sitter').Tree
export type SyntaxNode = import('tree-sitter').SyntaxNode

const parser = new Parser()

// Lazy grammar loaders — each grammar is require()'d on first use
type LanguageLoader = () => unknown

const LANGUAGE_LOADERS: Record<string, LanguageLoader> = {
  // TypeScript / JavaScript
  typescript: () => require('tree-sitter-typescript').typescript,
  tsx:        () => require('tree-sitter-typescript').tsx,
  javascript: () => require('tree-sitter-javascript'),
  // Python
  python:    () => require('tree-sitter-python'),
  // Go
  go:        () => require('tree-sitter-go'),
  // Rust
  rust:      () => require('tree-sitter-rust'),
  // Systems
  c:         () => require('tree-sitter-c'),
  cpp:       () => require('tree-sitter-cpp'),
  objc:      () => require('tree-sitter-objc'),
  zig:       () => require('tree-sitter-zig'),
  // JVM
  java:      () => require('tree-sitter-java'),
  kotlin:    () => require('tree-sitter-kotlin'),
  scala:     () => require('tree-sitter-scala'),
  // .NET
  c_sharp:   () => require('tree-sitter-c-sharp'),
  // Mobile
  swift:     () => require('tree-sitter-swift'),
  dart:      () => require('tree-sitter-dart'),
  // Scripting
  ruby:      () => require('tree-sitter-ruby'),
  php:       () => require('tree-sitter-php').php,
  lua:       () => require('tree-sitter-lua'),
  bash:      () => require('tree-sitter-bash'),
  elixir:    () => require('tree-sitter-elixir'),
  // Functional
  ocaml:     () => require('tree-sitter-ocaml').ocaml,
  elm:       () => require('tree-sitter-elm'),
  elisp:     () => require('tree-sitter-elisp'),
  // Web / Templating
  vue:       () => require('tree-sitter-vue'),
  liquid:    () => require('tree-sitter-liquid'),
  // Web3 / Other
  solidity:  () => require('tree-sitter-solidity'),
  ql:        () => require('tree-sitter-ql'),
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
  // Solidity
  '.sol': 'solidity',
  // Vue
  '.vue': 'vue',
  // Liquid
  '.liquid': 'liquid',
  // CodeQL
  '.ql': 'ql',
}

const languageCache = new Map<string, unknown>()

function loadLanguage(lang: string): unknown {
  const cached = languageCache.get(lang)
  if (cached) return cached

  const loader = LANGUAGE_LOADERS[lang]
  if (!loader) throw new Error(`Unsupported language: ${lang}`)

  const language = loader()
  languageCache.set(lang, language)
  return language
}

/** No-op — kept for backward compatibility with call sites. Native bindings need no async init. */
export async function initParser(): Promise<void> {}

export async function parseFile(filePath: string, language: string): Promise<Tree> {
  const lang = loadLanguage(language)
  parser.setLanguage(lang as Parameters<typeof parser.setLanguage>[0])
  const source = await fsRead(filePath, 'utf-8')
  return parser.parse(source)
}

export function parseSource(source: string, language: string): Tree {
  const lang = loadLanguage(language)
  parser.setLanguage(lang as Parameters<typeof parser.setLanguage>[0])
  return parser.parse(source)
}

export function languageFromPath(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'))
  return EXTENSION_MAP[ext] || null
}

export function supportedLanguages(): string[] {
  return Object.keys(LANGUAGE_LOADERS)
}
