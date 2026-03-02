import type Parser from 'tree-sitter'
type TSNode = Parser.SyntaxNode
type Tree = Parser.Tree
import type { ImportEdge } from '../types/index.js'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

export function extractImports(tree: Tree, file: string, language: string): ImportEdge[] {
  switch (language) {
    case 'typescript':
    case 'tsx':
    case 'javascript':
      return extractTsImports(tree, file)
    case 'python':
      return extractPythonImports(tree, file)
    case 'go':
      return extractGoImports(tree, file)
    case 'rust':
      return extractRustImports(tree, file)
    case 'c':
    case 'cpp':
    case 'objc':
      return extractCIncludes(tree, file)
    case 'java':
    case 'kotlin':
    case 'c_sharp':
    case 'scala':
    case 'dart':
      return extractJavaImports(tree, file)
    default:
      return extractGenericImports(tree, file)
  }
}

function extractTsImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source')
      if (!sourceNode) {
        for (const child of node.namedChildren as TSNode[]) {
          walk(child)
        }
        return
      }

      const rawPath = sourceNode.text.replace(/['"]/g, '')

      if (!rawPath.startsWith('.')) {
        return
      }

      const resolved = resolveImportPath(file, rawPath)
      const specifiers = extractSpecifiers(node)

      imports.push({
        source: file,
        target: resolved,
        specifiers,
      })
      return
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(tree.rootNode)
  return imports
}

function extractSpecifiers(importNode: TSNode): string[] {
  const specifiers: string[] = []

  function walk(node: TSNode) {
    if (node.type === 'import_specifier') {
      const name = node.childForFieldName('name')
      if (name) specifiers.push(name.text)
    } else if (node.type === 'namespace_import') {
      specifiers.push('*')
    } else if (node.type === 'identifier' && node.parent?.type === 'import_clause') {
      specifiers.push(node.text)
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(importNode)
  return specifiers
}

function resolveImportPath(fromFile: string, importPath: string): string {
  const dir = dirname(fromFile)
  let resolved = join(dir, importPath)

  resolved = resolved.replace(/\.(js|ts|tsx|jsx|mjs)$/, '')

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.js']
  for (const ext of extensions) {
    if (existsSync(resolved + ext)) {
      return resolved + ext
    }
  }

  return resolved + '.ts'
}

function extractPythonImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name')
      if (moduleNode) {
        const modulePath = moduleNode.text
        if (modulePath.startsWith('.')) {
          const specifiers: string[] = []
          for (const child of node.namedChildren as TSNode[]) {
            if (child.type === 'dotted_name' && child !== moduleNode) {
              specifiers.push(child.text)
            }
          }
          imports.push({
            source: file,
            target: resolvePythonImport(file, modulePath),
            specifiers,
          })
        }
      }
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(tree.rootNode)
  return imports
}

function resolvePythonImport(fromFile: string, importPath: string): string {
  const dir = dirname(fromFile)
  const parts = importPath.replace(/^\.+/, '')
  const dots = importPath.match(/^\.+/)?.[0].length || 1
  let base = dir
  for (let i = 1; i < dots; i++) base = dirname(base)
  return join(base, parts.replace(/\./g, '/') + '.py')
}

function extractGoImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'import_spec') {
      const pathNode = node.childForFieldName('path')
      if (pathNode) {
        imports.push({
          source: file,
          target: pathNode.text.replace(/"/g, ''),
          specifiers: ['*'],
        })
      }
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(tree.rootNode)
  return imports
}

function extractRustImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'use_declaration') {
      const path = (node.namedChildren as TSNode[]).find((c: TSNode) => c.type === 'scoped_identifier' || c.type === 'use_wildcard' || c.type === 'use_list')
      if (path) {
        imports.push({
          source: file,
          target: path.text,
          specifiers: ['*'],
        })
      }
    }

    for (const child of node.namedChildren as TSNode[]) {
      walk(child)
    }
  }

  walk(tree.rootNode)
  return imports
}

function extractCIncludes(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'preproc_include') {
      const pathNode = node.childForFieldName('path')
      if (pathNode) {
        const raw = pathNode.text.replace(/['"<>]/g, '')
        imports.push({ source: file, target: raw, specifiers: ['*'] })
      }
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return imports
}

function extractJavaImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []

  function walk(node: TSNode) {
    if (node.type === 'import_declaration') {
      // Java imports are like: import java.util.List;
      // The child is a scoped_identifier chain
      for (const child of node.namedChildren as TSNode[]) {
        if (child.type === 'scoped_identifier' || child.type === 'identifier') {
          imports.push({ source: file, target: child.text, specifiers: ['*'] })
          break
        }
      }
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return imports
}

function extractGenericImports(tree: Tree, file: string): ImportEdge[] {
  const imports: ImportEdge[] = []
  const importNodeTypes = new Set([
    'preproc_include', 'import_declaration', 'import_statement',
    'import_from_statement', 'use_declaration', 'namespace_use_declaration',
  ])

  function walk(node: TSNode) {
    if (importNodeTypes.has(node.type)) {
      const pathNode = node.childForFieldName('path') ||
                       node.childForFieldName('source') ||
                       node.childForFieldName('module_name')

      if (pathNode) {
        const raw = pathNode.text.replace(/['"<>]/g, '')
        imports.push({ source: file, target: raw, specifiers: ['*'] })
      } else {
        // Fallback: first named child that looks like a path
        for (const child of node.namedChildren as TSNode[]) {
          if (child.type === 'scoped_identifier' || child.type === 'dotted_name' ||
              child.type === 'string_literal' || child.type === 'string') {
            imports.push({ source: file, target: child.text.replace(/['"]/g, ''), specifiers: ['*'] })
            break
          }
        }
      }
      return
    }
    for (const child of node.namedChildren as TSNode[]) walk(child)
  }

  walk(tree.rootNode)
  return imports
}
