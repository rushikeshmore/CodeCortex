# Module: utils

## Purpose
3 files, 210 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/utils/files.ts, src/utils/markdown.ts, src/utils/yaml.ts

## Public API
- `readFile (function, src/utils/files.ts:5-11)`
- `writeFile (function, src/utils/files.ts:13-16)`
- `ensureDir (function, src/utils/files.ts:18-22)`
- `listFiles (function, src/utils/files.ts:24-36)`
- `fileExists (function, src/utils/files.ts:38-45)`
- `cortexDir (function, src/utils/files.ts:47-49)`
- `cortexPath (function, src/utils/files.ts:51-53)`
- `countLines (function, src/utils/files.ts:55-59)`
- `writeJsonStream (function, src/utils/files.ts:62-106)`
- `fileSize (function, src/utils/files.ts:108-115)`
- `generateModuleDoc (function, src/utils/markdown.ts:3-40)`
- `generateDecisionDoc (function, src/utils/markdown.ts:42-65)`
- `generatePatternEntry (function, src/utils/markdown.ts:67-83)`
- `parseYaml (function, src/utils/yaml.ts:3-5)`
- `stringifyYaml (function, src/utils/yaml.ts:7-9)`

## Dependencies
- Imports from: types
- Imported by: cli, core, mcp

## Temporal Signals
- **Churn:** 3 changes (moderate)
- **Coupled with:** none
- **Stability:** moderate
- **Bug history:** resolve TypeScript strict errors in writeJsonStream signature
- **Last changed:** 2026-03-02T23:31:18+05:30
