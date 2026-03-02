import { describe, it, expect } from 'vitest'
import { parseSource } from '../../src/extraction/parser.js'
import { extractImports } from '../../src/extraction/imports.js'

describe('extractImports — TypeScript', () => {
  it('extracts named imports from relative paths', () => {
    const source = `import { processData, Result } from './processor.js'
import { formatOutput } from '../utils/format.js'
`
    const tree = parseSource(source, 'typescript')
    const imports = extractImports(tree, 'src/core/index.ts', 'typescript')

    expect(imports).toHaveLength(2)
    expect(imports[0]!.source).toBe('src/core/index.ts')
    expect(imports[0]!.specifiers).toContain('processData')
    expect(imports[0]!.specifiers).toContain('Result')
    expect(imports[1]!.specifiers).toContain('formatOutput')
  })

  it('skips non-relative imports (external packages)', () => {
    const source = `import { z } from 'zod'
import express from 'express'
import { join } from 'node:path'
`
    const tree = parseSource(source, 'typescript')
    const imports = extractImports(tree, 'src/index.ts', 'typescript')

    expect(imports).toHaveLength(0)
  })

  it('extracts namespace imports', () => {
    const source = `import * as utils from './utils.js'`
    const tree = parseSource(source, 'typescript')
    const imports = extractImports(tree, 'src/index.ts', 'typescript')

    expect(imports).toHaveLength(1)
    expect(imports[0]!.specifiers).toContain('*')
  })

  it('extracts default imports', () => {
    const source = `import Parser from './parser.js'`
    const tree = parseSource(source, 'typescript')
    const imports = extractImports(tree, 'src/index.ts', 'typescript')

    expect(imports).toHaveLength(1)
    expect(imports[0]!.specifiers).toContain('Parser')
  })

  it('handles type-only imports', () => {
    const source = `import type { Config } from './types.js'`
    const tree = parseSource(source, 'typescript')
    const imports = extractImports(tree, 'src/index.ts', 'typescript')

    // Type imports are still import_statements in the AST
    expect(imports).toHaveLength(1)
  })
})

describe('extractImports — Go', () => {
  it('extracts Go imports', () => {
    const source = `package main

import (
    "fmt"
    "os"
    "github.com/gorilla/mux"
)`
    const tree = parseSource(source, 'go')
    const imports = extractImports(tree, 'main.go', 'go')

    expect(imports.length).toBeGreaterThanOrEqual(3)
    const targets = imports.map(i => i.target)
    expect(targets).toContain('fmt')
    expect(targets).toContain('os')
    expect(targets).toContain('github.com/gorilla/mux')
  })
})

describe('extractImports — Rust', () => {
  it('extracts Rust use declarations', () => {
    const source = `use std::collections::HashMap;
use crate::config::Config;
`
    const tree = parseSource(source, 'rust')
    const imports = extractImports(tree, 'src/lib.rs', 'rust')

    expect(imports.length).toBeGreaterThanOrEqual(1)
  })
})

describe('extractImports — C', () => {
  it('extracts #include directives', () => {
    const source = `#include <stdio.h>
#include "myheader.h"
`
    const tree = parseSource(source, 'c')
    const imports = extractImports(tree, 'src/main.c', 'c')

    expect(imports).toHaveLength(2)
    const targets = imports.map(i => i.target)
    expect(targets).toContain('stdio.h')
    expect(targets).toContain('myheader.h')
  })
})

describe('extractImports — Java', () => {
  it('extracts Java imports', () => {
    const source = `import java.util.List;
import java.util.Map;

public class Main {}
`
    const tree = parseSource(source, 'java')
    const imports = extractImports(tree, 'Main.java', 'java')

    expect(imports).toHaveLength(2)
  })
})
