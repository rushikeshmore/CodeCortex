import { describe, it, expect } from 'vitest'
import { languageFromPath, supportedLanguages, parseSource, initParser } from '../../src/extraction/parser.js'

describe('languageFromPath', () => {
  it('maps TypeScript extensions', () => {
    expect(languageFromPath('src/index.ts')).toBe('typescript')
    expect(languageFromPath('src/App.tsx')).toBe('tsx')
  })

  it('maps JavaScript extensions', () => {
    expect(languageFromPath('lib/main.js')).toBe('javascript')
    expect(languageFromPath('lib/main.mjs')).toBe('javascript')
    expect(languageFromPath('lib/main.cjs')).toBe('javascript')
    expect(languageFromPath('lib/App.jsx')).toBe('javascript')
  })

  it('maps Python extensions', () => {
    expect(languageFromPath('app.py')).toBe('python')
    expect(languageFromPath('stubs.pyi')).toBe('python')
  })

  it('maps Go', () => {
    expect(languageFromPath('main.go')).toBe('go')
  })

  it('maps Rust', () => {
    expect(languageFromPath('lib.rs')).toBe('rust')
  })

  it('maps C/C++', () => {
    expect(languageFromPath('main.c')).toBe('c')
    expect(languageFromPath('header.h')).toBe('c')
    expect(languageFromPath('main.cpp')).toBe('cpp')
    expect(languageFromPath('main.cc')).toBe('cpp')
    expect(languageFromPath('header.hpp')).toBe('cpp')
  })

  it('maps JVM languages', () => {
    expect(languageFromPath('Main.java')).toBe('java')
    expect(languageFromPath('App.kt')).toBe('kotlin')
    expect(languageFromPath('App.scala')).toBe('scala')
  })

  it('maps other languages', () => {
    expect(languageFromPath('app.rb')).toBe('ruby')
    expect(languageFromPath('app.php')).toBe('php')
    expect(languageFromPath('script.sh')).toBe('bash')
    expect(languageFromPath('app.swift')).toBe('swift')
    expect(languageFromPath('app.dart')).toBe('dart')
    expect(languageFromPath('app.cs')).toBe('c_sharp')
    expect(languageFromPath('app.lua')).toBe('lua')
    expect(languageFromPath('app.ex')).toBe('elixir')
    expect(languageFromPath('app.ml')).toBe('ocaml')
    expect(languageFromPath('app.elm')).toBe('elm')
    expect(languageFromPath('app.el')).toBe('elisp')
    expect(languageFromPath('Contract.sol')).toBe('solidity')
    expect(languageFromPath('App.vue')).toBe('vue')
    expect(languageFromPath('query.ql')).toBe('ql')
    expect(languageFromPath('app.zig')).toBe('zig')
    expect(languageFromPath('app.m')).toBe('objc')
  })

  it('returns null for unsupported extensions', () => {
    expect(languageFromPath('file.txt')).toBeNull()
    expect(languageFromPath('Makefile')).toBeNull()
    expect(languageFromPath('data.json')).toBeNull()
    expect(languageFromPath('.gitignore')).toBeNull()
  })
})

describe('supportedLanguages', () => {
  it('returns all 28 supported languages', () => {
    const langs = supportedLanguages()
    expect(langs.length).toBe(28)
    expect(langs).toContain('typescript')
    expect(langs).toContain('python')
    expect(langs).toContain('go')
    expect(langs).toContain('rust')
    expect(langs).toContain('c')
    expect(langs).toContain('java')
    expect(langs).toContain('liquid')
  })
})

describe('initParser', () => {
  it('is a no-op (native bindings need no async init)', async () => {
    await expect(initParser()).resolves.toBeUndefined()
  })
})

describe('parseSource', () => {
  it('parses TypeScript source code', () => {
    const source = `export function add(a: number, b: number): number {
  return a + b
}`
    const tree = parseSource(source, 'typescript')
    expect(tree).toBeDefined()
    expect(tree.rootNode).toBeDefined()
    expect(tree.rootNode.type).toBe('program')
    expect(tree.rootNode.namedChildren.length).toBeGreaterThan(0)
  })

  it('parses Python source code', () => {
    const source = `def greet(name: str) -> str:
    return f"Hello, {name}!"
`
    const tree = parseSource(source, 'python')
    expect(tree.rootNode.type).toBe('module')
  })

  it('parses Go source code', () => {
    const source = `package main

func Add(a, b int) int {
    return a + b
}`
    const tree = parseSource(source, 'go')
    expect(tree.rootNode.type).toBe('source_file')
  })

  it('parses Rust source code', () => {
    const source = `pub fn add(a: i32, b: i32) -> i32 {
    a + b
}`
    const tree = parseSource(source, 'rust')
    expect(tree.rootNode.type).toBe('source_file')
  })

  it('parses C source code', () => {
    const source = `int add(int a, int b) {
    return a + b;
}`
    const tree = parseSource(source, 'c')
    expect(tree.rootNode.type).toBe('translation_unit')
  })

  it('parses Java source code', () => {
    const source = `public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}`
    const tree = parseSource(source, 'java')
    expect(tree.rootNode.type).toBe('program')
  })

  it('throws on unsupported language', () => {
    expect(() => parseSource('hello', 'cobol')).toThrow('Unsupported language: cobol')
  })
})
