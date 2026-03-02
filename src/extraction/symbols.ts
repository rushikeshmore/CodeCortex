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

const C_CPP_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'function_definition',
    'declaration',
    'struct_specifier',
    'enum_specifier',
    'union_specifier',
    'type_definition',
    'preproc_function_def',
    // C++ additions
    'class_specifier',
    'namespace_definition',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      function_definition: 'function',
      declaration: 'variable',
      struct_specifier: 'class',
      enum_specifier: 'enum',
      union_specifier: 'class',
      type_definition: 'type',
      preproc_function_def: 'function',
      class_specifier: 'class',
      namespace_definition: 'class',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    // Try 'name' field (struct, enum, class, namespace, macro)
    const nameNode = node.childForFieldName('name')
    if (nameNode) return nameNode.text

    // For function_definition and declaration: dig through declarator chain
    let declarator = node.childForFieldName('declarator')
    while (declarator) {
      if (declarator.type === 'identifier' || declarator.type === 'type_identifier' || declarator.type === 'field_identifier') {
        return declarator.text
      }
      const inner = declarator.childForFieldName('declarator')
      if (inner) {
        declarator = inner
        continue
      }
      const declName = declarator.childForFieldName('name')
      if (declName) return declName.text
      break
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
    // C: static means file-private, everything else at top level is exported
    if (node.text.startsWith('static ')) return false
    if (node.text.startsWith('public ')) return true
    return node.parent?.type === 'translation_unit' || false
  },
}

const JAVA_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'method_declaration',
    'constructor_declaration',
    'field_declaration',
    'annotation_type_declaration',
    // Kotlin
    'function_declaration',
    'object_declaration',
  ]),
  getKind(type) {
    const map: Record<string, SymbolRecord['kind']> = {
      class_declaration: 'class',
      interface_declaration: 'interface',
      enum_declaration: 'enum',
      method_declaration: 'method',
      constructor_declaration: 'method',
      field_declaration: 'property',
      annotation_type_declaration: 'interface',
      function_declaration: 'function',
      object_declaration: 'class',
    }
    return map[type] || 'variable'
  },
  getName(node: TSNode) {
    const nameNode = node.childForFieldName('name')
    if (nameNode) return nameNode.text
    // For field_declaration: dig into declarators
    for (const child of node.namedChildren as TSNode[]) {
      if (child.type === 'variable_declarator') {
        const name = child.childForFieldName('name')
        if (name) return name.text
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
    return node.text.startsWith('public ') || node.text.startsWith('protected ')
  },
}

const GENERIC_QUERY: SymbolQuery = {
  nodeTypes: new Set([
    // Functions
    'function_declaration', 'function_definition', 'function_item',
    'method_declaration', 'method_definition', 'method',
    // Classes / structs
    'class_declaration', 'class_definition', 'class_specifier',
    'struct_specifier', 'struct_item', 'struct_declaration',
    'module_definition', 'module',
    // Interfaces / traits / protocols
    'interface_declaration', 'trait_item', 'protocol_declaration',
    // Enums
    'enum_declaration', 'enum_item', 'enum_specifier', 'enum_definition',
    // Types
    'type_declaration', 'type_alias_declaration', 'type_item', 'type_definition',
    // Constants
    'const_declaration', 'const_item',
  ]),
  getKind(type) {
    if (type.includes('function') || type.includes('method')) return 'function'
    if (type.includes('class') || type.includes('struct') || type.includes('module')) return 'class'
    if (type.includes('interface') || type.includes('trait') || type.includes('protocol')) return 'interface'
    if (type.includes('enum')) return 'enum'
    if (type.includes('type')) return 'type'
    if (type.includes('const')) return 'const'
    return 'variable'
  },
  getName(node: TSNode) {
    // Try standard 'name' field (most languages)
    const nameNode = node.childForFieldName('name')
    if (nameNode) return nameNode.text

    // Try 'declarator' chain (C-family)
    let declarator = node.childForFieldName('declarator')
    while (declarator) {
      if (declarator.type === 'identifier' || declarator.type === 'type_identifier') return declarator.text
      const inner = declarator.childForFieldName('declarator') || declarator.childForFieldName('name')
      if (inner) {
        if (inner.type === 'identifier' || inner.type === 'type_identifier') return inner.text
        declarator = inner
        continue
      }
      break
    }

    // Last resort: first identifier child
    for (const child of node.namedChildren as TSNode[]) {
      if (child.type === 'identifier' || child.type === 'type_identifier') return child.text
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
    const text = node.text
    if (text.startsWith('pub ') || text.startsWith('public ') || text.startsWith('export ')) return true
    const parent = node.parent
    if (parent?.type === 'export_statement') return true
    return false
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
    case 'c':
    case 'cpp':
    case 'objc':
      return C_CPP_QUERY
    case 'java':
    case 'kotlin':
    case 'c_sharp':
    case 'scala':
    case 'dart':
      return JAVA_QUERY
    default:
      return GENERIC_QUERY
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
