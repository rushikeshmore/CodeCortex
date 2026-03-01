import type { Node as TSNode, Tree } from 'web-tree-sitter'
import type { SymbolRecord } from '../types/index.js'

interface SymbolQuery {
  nodeTypes: Set<string>
  getKind: (type: string) => SymbolRecord['kind']
  getName: (node: TSNode) => string | null
  getSignature: (node: TSNode, source: string) => string | undefined
  isExported: (node: TSNode) => boolean
}

const TS_JS_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'function_declaration',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'lexical_declaration',
    'variable_declaration',
    'method_definition',
    'public_field_definition',
    'export_statement',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      function_declaration: 'function',
      class_declaration: 'class',
      interface_declaration: 'interface',
      type_alias_declaration: 'type',
      enum_declaration: 'enum',
      lexical_declaration: 'const',
      variable_declaration: 'variable',
      method_definition: 'method',
      public_field_definition: 'property',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    const nameNode = node.childForFieldName('name')
    if (nameNode) return nameNode.text

    // For lexical_declaration, dig into declarators
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      const declarator = (node.namedChildren as TSNode[]).find((c: TSNode) =>
        c.type === 'variable_declarator'
      )
      if (declarator) {
        const name = declarator.childForFieldName('name')
        return name?.text || null
      }
    }
    return null
  },
  getSignature(node: TSNode, source: string) {
    const startLine = node.startPosition.row
    const lines = source.split('\n')
    const line = lines[startLine]
    if (!line) return undefined
    const sig = line.trim()
    return sig.length > 200 ? sig.slice(0, 200) + '...' : sig
  },
  isExported(node: TSNode) {
    const parent = node.parent
    if (!parent) return false
    if (parent.type === 'export_statement') return true
    if (node.type === 'lexical_declaration') {
      return parent.type === 'export_statement'
    }
    return false
  },
}

const PYTHON_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'function_definition',
    'class_definition',
    'assignment',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      function_definition: 'function',
      class_definition: 'class',
      assignment: 'variable',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    const nameNode = node.childForFieldName('name')
    if (nameNode) return nameNode.text
    if (node.type === 'assignment') {
      const left = node.childForFieldName('left')
      return left?.text || null
    }
    return null
  },
  getSignature(node: TSNode, source: string) {
    const startLine = node.startPosition.row
    const lines = source.split('\n')
    return lines[startLine]?.trim()
  },
  isExported(node: TSNode) {
    const name = PYTHON_QUERY.getName(node)
    return name ? !name.startsWith('_') : false
  },
}

const GO_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'function_declaration',
    'method_declaration',
    'type_declaration',
    'const_declaration',
    'var_declaration',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      function_declaration: 'function',
      method_declaration: 'method',
      type_declaration: 'type',
      const_declaration: 'const',
      var_declaration: 'variable',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    const nameNode = node.childForFieldName('name')
    return nameNode?.text || null
  },
  getSignature(node: TSNode, source: string) {
    const startLine = node.startPosition.row
    const lines = source.split('\n')
    return lines[startLine]?.trim()
  },
  isExported(node: TSNode) {
    const name = GO_QUERY.getName(node)
    return name ? /^[A-Z]/.test(name) : false
  },
}

const RUST_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'function_item',
    'struct_item',
    'enum_item',
    'impl_item',
    'trait_item',
    'type_item',
    'const_item',
    'static_item',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      function_item: 'function',
      struct_item: 'class',
      enum_item: 'enum',
      impl_item: 'class',
      trait_item: 'interface',
      type_item: 'type',
      const_item: 'const',
      static_item: 'variable',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    const nameNode = node.childForFieldName('name')
    return nameNode?.text || null
  },
  getSignature(node: TSNode, source: string) {
    const startLine = node.startPosition.row
    const lines = source.split('\n')
    return lines[startLine]?.trim()
  },
  isExported(node: TSNode) {
    const text = node.text
    return text.startsWith('pub ')
  },
}

function getQuery(language: string): SymbolQuery {
  switch (language) {
    case 'typescript':
    case 'tsx':
    case 'javascript':
      return TS_JS_QUERY
    case 'python':
      return PYTHON_QUERY
    case 'go':
      return GO_QUERY
    case 'rust':
      return RUST_QUERY
    default:
      return TS_JS_QUERY
  }
}

export function extractSymbols(tree: Tree, file: string, language: string, source: string): SymbolRecord[] {
  const query = getQuery(language)
  const symbols: SymbolRecord[] = []

  function walk(node: TSNode, parentName?: string) {
    if (query.nodeTypes.has(node.type)) {
      if (node.type === 'export_statement') {
        const declaration = (node.namedChildren as TSNode[]).find((c: TSNode) => query.nodeTypes.has(c.type))
        if (declaration) {
          const name = query.getName(declaration)
          if (name) {
            symbols.push({
              name,
              kind: query.getKind(declaration.type),
              file,
              startLine: declaration.startPosition.row + 1,
              endLine: declaration.endPosition.row + 1,
              signature: query.getSignature(declaration, source),
              exported: true,
              parentName,
            })
          }
          for (const child of declaration.namedChildren as TSNode[]) {
            walk(child, name || parentName)
          }
          return
        }
        return
      }

      const name = query.getName(node)
      if (name) {
        symbols.push({
          name,
          kind: query.getKind(node.type),
          file,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          signature: query.getSignature(node, source),
          exported: query.isExported(node),
          parentName,
        })
      }

      for (const child of node.namedChildren as TSNode[]) {
        walk(child, name || parentName)
      }
      return
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child, parentName)
    }
  }

  walk(tree.rootNode)
  return symbols
}
