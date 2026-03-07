# Module: core

## Purpose
10 files, 866 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/core/module-gen.ts, src/core/constitution.ts, src/core/decisions.ts, src/core/discovery.ts, src/core/graph.ts, src/core/manifest.ts, src/core/modules.ts, src/core/patterns.ts, src/core/search.ts, src/core/sessions.ts

## Public API
- `StructuralModuleData (interface, src/core/module-gen.ts:7-11)`
- `generateStructuralModuleDocs (function, src/core/module-gen.ts:13-99)`
- `ConstitutionData (interface, src/core/constitution.ts:7-12)`
- `generateConstitution (function, src/core/constitution.ts:14-144)`
- `readDecision (function, src/core/decisions.ts:5-7)`
- `writeDecision (function, src/core/decisions.ts:9-14)`
- `listDecisions (function, src/core/decisions.ts:16-23)`
- `createDecision (function, src/core/decisions.ts:25-48)`
- `discoverProject (function, src/core/discovery.ts:19-28)`
- `readGraph (function, src/core/graph.ts:6-10)`
- `writeGraph (function, src/core/graph.ts:12-52)`
- `buildGraph (function, src/core/graph.ts:54-69)`
- `getModuleDependencies (function, src/core/graph.ts:71-85)`
- `getFileImporters (function, src/core/graph.ts:87-91)`
- `getMostImportedFiles (function, src/core/graph.ts:93-103)`
- `enrichCouplingWithImports (function, src/core/graph.ts:105-118)`
- `readManifest (function, src/core/manifest.ts:5-9)`
- `writeManifest (function, src/core/manifest.ts:11-14)`
- `createManifest (function, src/core/manifest.ts:16-41)`
- `updateManifest (function, src/core/manifest.ts:43-58)`
- `readModuleDoc (function, src/core/modules.ts:5-7)`
- `writeModuleDoc (function, src/core/modules.ts:9-14)`
- `listModuleDocs (function, src/core/modules.ts:16-23)`
- `buildAnalysisPrompt (function, src/core/modules.ts:25-42)`
- `readPatterns (function, src/core/patterns.ts:5-7)`
- `addPattern (function, src/core/patterns.ts:9-31)`
- `SearchResult (interface, src/core/search.ts:6-11)`
- `searchKnowledge (function, src/core/search.ts:13-46)`
- `writeSession (function, src/core/sessions.ts:4-29)`
- `readSession (function, src/core/sessions.ts:31-33)`
- `listSessions (function, src/core/sessions.ts:35-42)`
- `getLatestSession (function, src/core/sessions.ts:44-47)`
- `createSession (function, src/core/sessions.ts:49-68)`

## Dependencies
- Imports from: utils, types, extraction
- Imported by: cli, mcp

## Temporal Signals
- **Churn:** 3 changes (moderate)
- **Coupled with:** src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/git/temporal.ts (3 co-changes, 100%)
- **Stability:** moderate
- **Last changed:** 2026-03-02T13:22:57+05:30
