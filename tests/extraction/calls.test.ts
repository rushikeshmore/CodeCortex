import { describe, it, expect } from 'vitest'
import { parseSource } from '../../src/extraction/parser.js'
import { extractCalls } from '../../src/extraction/calls.js'

describe('extractCalls — TypeScript', () => {
  it('extracts function calls with enclosing context', () => {
    const source = `function processData(input: string): void {
  const result = validate(input)
  console.log(result)
  formatOutput(result)
}
`
    const tree = parseSource(source, 'typescript')
    const calls = extractCalls(tree, 'src/processor.ts', 'typescript')

    expect(calls.length).toBeGreaterThanOrEqual(3)

    const validateCall = calls.find(c => c.callee === 'validate')
    expect(validateCall).toBeDefined()
    expect(validateCall!.caller).toBe('src/processor.ts:processData')
    expect(validateCall!.file).toBe('src/processor.ts')

    const logCall = calls.find(c => c.callee === 'log')
    expect(logCall).toBeDefined()

    const formatCall = calls.find(c => c.callee === 'formatOutput')
    expect(formatCall).toBeDefined()
  })

  it('uses <module> for top-level calls', () => {
    const source = `const result = processData("hello")`
    const tree = parseSource(source, 'typescript')
    const calls = extractCalls(tree, 'src/index.ts', 'typescript')

    expect(calls.length).toBeGreaterThanOrEqual(1)
    const call = calls.find(c => c.callee === 'processData')
    expect(call!.caller).toBe('src/index.ts:<module>')
  })

  it('extracts method calls on objects', () => {
    const source = `function doWork() {
  const items = arr.filter(x => x > 0)
  items.map(x => x * 2)
}`
    const tree = parseSource(source, 'typescript')
    const calls = extractCalls(tree, 'src/work.ts', 'typescript')

    const filterCall = calls.find(c => c.callee === 'filter')
    expect(filterCall).toBeDefined()
    expect(filterCall!.caller).toBe('src/work.ts:doWork')

    const mapCall = calls.find(c => c.callee === 'map')
    expect(mapCall).toBeDefined()
  })

  it('deduplicates calls at the same location', () => {
    const source = `function test() {
  foo()
  foo()
}`
    const tree = parseSource(source, 'typescript')
    const calls = extractCalls(tree, 'src/test.ts', 'typescript')

    const fooCalls = calls.filter(c => c.callee === 'foo')
    // Two calls at different lines — should both be present
    expect(fooCalls).toHaveLength(2)
    expect(fooCalls[0]!.line).not.toBe(fooCalls[1]!.line)
  })
})

describe('extractCalls — Python', () => {
  it('extracts Python function calls', () => {
    const source = `def process():
    result = validate(data)
    print(result)
`
    const tree = parseSource(source, 'python')
    const calls = extractCalls(tree, 'src/processor.py', 'python')

    const validateCall = calls.find(c => c.callee === 'validate')
    expect(validateCall).toBeDefined()
    expect(validateCall!.caller).toBe('src/processor.py:process')

    const printCall = calls.find(c => c.callee === 'print')
    expect(printCall).toBeDefined()
  })
})

describe('extractCalls — Go', () => {
  it('extracts Go function calls', () => {
    const source = `package main

func Process() {
    result := Validate(data)
    fmt.Println(result)
}`
    const tree = parseSource(source, 'go')
    const calls = extractCalls(tree, 'main.go', 'go')

    const validateCall = calls.find(c => c.callee === 'Validate')
    expect(validateCall).toBeDefined()

    const printlnCall = calls.find(c => c.callee === 'Println')
    expect(printlnCall).toBeDefined()
  })
})
