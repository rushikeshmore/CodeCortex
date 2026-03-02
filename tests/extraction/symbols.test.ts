import { describe, it, expect } from 'vitest'
import { parseSource } from '../../src/extraction/parser.js'
import { extractSymbols } from '../../src/extraction/symbols.js'

describe('extractSymbols — TypeScript', () => {
  const source = `export function processData(input: string): Result {
  return { ok: true }
}

export interface Result {
  ok: boolean
}

export class DataProcessor {
  private cache: Map<string, string> = new Map()

  process(data: string): void {
    this.cache.set(data, data)
  }
}

export type Config = {
  timeout: number
}

export const MAX_RETRIES = 3

export enum Status {
  Active,
  Inactive,
}

const internalHelper = () => {}
`

  const tree = parseSource(source, 'typescript')
  const symbols = extractSymbols(tree, 'src/core/processor.ts', 'typescript', source)

  it('extracts exported function', () => {
    const fn = symbols.find(s => s.name === 'processData')
    expect(fn).toBeDefined()
    expect(fn!.kind).toBe('function')
    expect(fn!.exported).toBe(true)
    expect(fn!.file).toBe('src/core/processor.ts')
    expect(fn!.startLine).toBe(1)
  })

  it('extracts exported interface', () => {
    const iface = symbols.find(s => s.name === 'Result')
    expect(iface).toBeDefined()
    expect(iface!.kind).toBe('interface')
    expect(iface!.exported).toBe(true)
  })

  it('extracts exported class', () => {
    const cls = symbols.find(s => s.name === 'DataProcessor')
    expect(cls).toBeDefined()
    expect(cls!.kind).toBe('class')
    expect(cls!.exported).toBe(true)
  })

  it('extracts exported type alias', () => {
    const typ = symbols.find(s => s.name === 'Config')
    expect(typ).toBeDefined()
    expect(typ!.kind).toBe('type')
    expect(typ!.exported).toBe(true)
  })

  it('extracts exported const', () => {
    const c = symbols.find(s => s.name === 'MAX_RETRIES')
    expect(c).toBeDefined()
    expect(c!.kind).toBe('const')
    expect(c!.exported).toBe(true)
  })

  it('extracts exported enum', () => {
    const e = symbols.find(s => s.name === 'Status')
    expect(e).toBeDefined()
    expect(e!.kind).toBe('enum')
    expect(e!.exported).toBe(true)
  })

  it('marks non-exported symbols', () => {
    const helper = symbols.find(s => s.name === 'internalHelper')
    expect(helper).toBeDefined()
    expect(helper!.exported).toBe(false)
  })

  it('includes signature', () => {
    const fn = symbols.find(s => s.name === 'processData')
    expect(fn!.signature).toContain('processData')
  })
})

describe('extractSymbols — Python', () => {
  const source = `def process_data(input: str) -> dict:
    return {"ok": True}

class DataProcessor:
    def __init__(self):
        self.cache = {}

    def process(self, data: str) -> None:
        self.cache[data] = data

_internal = "hidden"
PUBLIC_CONST = 42
`

  const tree = parseSource(source, 'python')
  const symbols = extractSymbols(tree, 'src/processor.py', 'python', source)

  it('extracts function', () => {
    const fn = symbols.find(s => s.name === 'process_data')
    expect(fn).toBeDefined()
    expect(fn!.kind).toBe('function')
    expect(fn!.exported).toBe(true) // no underscore prefix
  })

  it('extracts class', () => {
    const cls = symbols.find(s => s.name === 'DataProcessor')
    expect(cls).toBeDefined()
    expect(cls!.kind).toBe('class')
  })

  it('marks underscore-prefixed as non-exported', () => {
    const priv = symbols.find(s => s.name === '_internal')
    expect(priv).toBeDefined()
    expect(priv!.exported).toBe(false)
  })

  it('marks public variables as exported', () => {
    const pub = symbols.find(s => s.name === 'PUBLIC_CONST')
    expect(pub).toBeDefined()
    expect(pub!.exported).toBe(true)
  })
})

describe('extractSymbols — Go', () => {
  const source = `package main

func ProcessData(input string) map[string]interface{} {
    return nil
}

type Config struct {
    Timeout int
}

const MaxRetries = 3

func helperFunc() {}
`

  const tree = parseSource(source, 'go')
  const symbols = extractSymbols(tree, 'main.go', 'go', source)

  it('extracts exported function (uppercase)', () => {
    const fn = symbols.find(s => s.name === 'ProcessData')
    expect(fn).toBeDefined()
    expect(fn!.kind).toBe('function')
    expect(fn!.exported).toBe(true)
  })

  it('extracts struct from type_declaration (traverses into type_spec for name)', () => {
    const t = symbols.find(s => s.name === 'Config')
    expect(t).toBeDefined()
    expect(t!.kind).toBe('type')
    expect(t!.exported).toBe(true) // uppercase = exported in Go
  })

  it('extracts const declaration (traverses into const_spec for name)', () => {
    const c = symbols.find(s => s.name === 'MaxRetries')
    expect(c).toBeDefined()
    expect(c!.kind).toBe('const')
    expect(c!.exported).toBe(true) // uppercase
  })

  it('marks lowercase function as unexported', () => {
    const fn = symbols.find(s => s.name === 'helperFunc')
    expect(fn).toBeDefined()
    expect(fn!.exported).toBe(false)
  })
})

describe('extractSymbols — Rust', () => {
  const source = `pub fn process_data(input: &str) -> Result<(), Error> {
    Ok(())
}

pub struct Config {
    pub timeout: u64,
}

pub enum Status {
    Active,
    Inactive,
}

fn internal_helper() {}
`

  const tree = parseSource(source, 'rust')
  const symbols = extractSymbols(tree, 'src/lib.rs', 'rust', source)

  it('extracts pub function', () => {
    const fn = symbols.find(s => s.name === 'process_data')
    expect(fn).toBeDefined()
    expect(fn!.kind).toBe('function')
    expect(fn!.exported).toBe(true)
  })

  it('extracts pub struct as class', () => {
    const s = symbols.find(s => s.name === 'Config')
    expect(s).toBeDefined()
    expect(s!.kind).toBe('class')
    expect(s!.exported).toBe(true)
  })

  it('extracts pub enum', () => {
    const e = symbols.find(s => s.name === 'Status')
    expect(e).toBeDefined()
    expect(e!.kind).toBe('enum')
    expect(e!.exported).toBe(true)
  })

  it('marks non-pub as unexported', () => {
    const fn = symbols.find(s => s.name === 'internal_helper')
    expect(fn).toBeDefined()
    expect(fn!.exported).toBe(false)
  })
})

describe('extractSymbols — C', () => {
  const source = `#include <stdio.h>

int process_data(const char* input) {
    return 0;
}

struct Config {
    int timeout;
};

static void internal_helper(void) {}
`

  const tree = parseSource(source, 'c')
  const symbols = extractSymbols(tree, 'src/main.c', 'c', source)

  it('extracts top-level function as exported', () => {
    const fn = symbols.find(s => s.name === 'process_data')
    expect(fn).toBeDefined()
    expect(fn!.kind).toBe('function')
    expect(fn!.exported).toBe(true)
  })

  it('extracts struct', () => {
    const s = symbols.find(s => s.name === 'Config')
    expect(s).toBeDefined()
    expect(s!.kind).toBe('class')
  })

  it('marks static as unexported', () => {
    const fn = symbols.find(s => s.name === 'internal_helper')
    expect(fn).toBeDefined()
    expect(fn!.exported).toBe(false)
  })
})
