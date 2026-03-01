import type { Node as TSNode, Tree } from 'web-tree-sitter'
import type { CallEdge } from '../types/index.js'

export function extractCalls(tree: Tree, file: string, language: string): CallEdge[] {
  switch (language) {
    case 'typescript':
    case 'tsx':
    case 'javascript':
      return extractTsCalls(tree, file)
    case 'python':
      return extractPythonCalls(tree, file)
    case 'go':
      return extractGoCalls(tree, file)
    case 'rust':
      return extractRustCalls(tree, file)
    default:
      return []
  }
}

function extractTsCalls(tree: Tree, file: string): CallEdge[] {
  const calls: CallEdge[] = []
  const seen = new Set<string>()

  function findEnclosingFunction(node: TSNode): string {
    let current = node.parent
    while (current) {
      if (
        current.type === 'function_declaration' ||
        current.type === 'method_definition' ||
        current.type === 'arrow_function'
      ) {
        const name = current.childForFieldName('name')
        if (name) return name.text
        if (current.parent?.type === 'variable_declarator') {
          const varName = current.parent.childForFieldName('name')
          if (varName) return varName.text
        }
        return '<anonymous>'
      }
      current = current.parent
    }
    return '<module>'
  }

  function walk(node: TSNode) {
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function')
      if (funcNode) {
        let callee: string
        if (funcNode.type === 'member_expression') {
          const prop = funcNode.childForFieldName('property')
          callee = prop?.text || funcNode.text
        } else {
          callee = funcNode.text
        }

        const caller = findEnclosingFunction(node)
        const key = `${caller}:${callee}:${node.startPosition.row}`
        if (!seen.has(key)) {
          seen.add(key)
          calls.push({
            caller: `${file}:${caller}`,
            callee,
            file,
            line: node.startPosition.row + 1,
          })
        }
      }
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(tree.rootNode)
  return calls
}

function extractPythonCalls(tree: Tree, file: string): CallEdge[] {
  const calls: CallEdge[] = []
  const seen = new Set<string>()

  function findEnclosing(node: TSNode): string {
    let current = node.parent
    while (current) {
      if (current.type === 'function_definition') {
        const name = current.childForFieldName('name')
        if (name) return name.text
      }
      current = current.parent
    }
    return '<module>'
  }

  function walk(node: TSNode) {
    if (node.type === 'call') {
      const funcNode = node.childForFieldName('function')
      if (funcNode) {
        const callee = funcNode.type === 'attribute'
          ? funcNode.childForFieldName('attribute')?.text || funcNode.text
          : funcNode.text
        const caller = findEnclosing(node)
        const key = `${caller}:${callee}:${node.startPosition.row}`
        if (!seen.has(key)) {
          seen.add(key)
          calls.push({ caller: `${file}:${caller}`, callee, file, line: node.startPosition.row + 1 })
        }
      }
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return calls
}

function extractGoCalls(tree: Tree, file: string): CallEdge[] {
  const calls: CallEdge[] = []
  const seen = new Set<string>()

  function findEnclosing(node: TSNode): string {
    let current = node.parent
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'method_declaration') {
        const name = current.childForFieldName('name')
        if (name) return name.text
      }
      current = current.parent
    }
    return '<module>'
  }

  function walk(node: TSNode) {
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function')
      if (funcNode) {
        const callee = funcNode.type === 'selector_expression'
          ? funcNode.childForFieldName('field')?.text || funcNode.text
          : funcNode.text
        const caller = findEnclosing(node)
        const key = `${caller}:${callee}:${node.startPosition.row}`
        if (!seen.has(key)) {
          seen.add(key)
          calls.push({ caller: `${file}:${caller}`, callee, file, line: node.startPosition.row + 1 })
        }
      }
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return calls
}

function extractRustCalls(tree: Tree, file: string): CallEdge[] {
  const calls: CallEdge[] = []
  const seen = new Set<string>()

  function findEnclosing(node: TSNode): string {
    let current = node.parent
    while (current) {
      if (current.type === 'function_item') {
        const name = current.childForFieldName('name')
        if (name) return name.text
      }
      current = current.parent
    }
    return '<module>'
  }

  function walk(node: TSNode) {
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function')
      if (funcNode) {
        const callee = funcNode.text.split('::').pop() || funcNode.text
        const caller = findEnclosing(node)
        const key = `${caller}:${callee}:${node.startPosition.row}`
        if (!seen.has(key)) {
          seen.add(key)
          calls.push({ caller: `${file}:${caller}`, callee, file, line: node.startPosition.row + 1 })
        }
      }
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return calls
}
