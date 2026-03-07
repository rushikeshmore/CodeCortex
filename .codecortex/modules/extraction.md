# Module: extraction

## Purpose
4 files, 1148 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/extraction/calls.ts, src/extraction/imports.ts, src/extraction/parser.ts, src/extraction/symbols.ts

## Public API
- `extractCalls (function, src/extraction/calls.ts:6-21)`
- `extractImports (function, src/extraction/imports.ts:8-33)`
- `Tree (type, src/extraction/parser.ts:8)`
- `SyntaxNode (type, src/extraction/parser.ts:9)`
- `EXTENSION_MAP (const, src/extraction/parser.ts:57-127)`
- `initParser (function, src/extraction/parser.ts:144)`
- `parseFile (function, src/extraction/parser.ts:146-151)`
- `parseSource (function, src/extraction/parser.ts:153-157)`
- `languageFromPath (function, src/extraction/parser.ts:159-162)`
- `supportedLanguages (function, src/extraction/parser.ts:164-166)`
- `extractSymbols (function, src/extraction/symbols.ts:409-466)`

## Dependencies
- Imports from: types
- Imported by: cli, core

## Temporal Signals
- **Churn:** 4 changes (moderate)
- **Coupled with:** src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/extraction/imports.ts (3 co-changes, 100%), src/extraction/parser.ts (3 co-changes, 100%), src/extraction/symbols.ts (3 co-changes, 75%), tsup.config.ts (3 co-changes, 100%), src/extraction/parser.ts (3 co-changes, 100%), src/extraction/symbols.ts (3 co-changes, 75%), tsup.config.ts (3 co-changes, 100%), src/extraction/symbols.ts (3 co-changes, 75%), tsup.config.ts (3 co-changes, 100%), tsup.config.ts (3 co-changes, 75%)
- **Stability:** moderate
- **Bug history:** Go type extraction, docs cleanup, npm publish as codecortex-ai
- **Last changed:** 2026-03-02T23:50:46+05:30
