# Module: cli

## Purpose
9 files, 1025 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/cli/commands/hotspots.ts, src/cli/commands/modules.ts, src/cli/commands/search.ts, src/cli/commands/symbols.ts, src/cli/commands/init.ts, src/cli/commands/serve.ts, src/cli/commands/status.ts, src/cli/commands/update.ts, src/cli/index.ts

## Public API
- `hotspotsCommand (function, src/cli/commands/hotspots.ts:6-79)`
- `modulesCommand (function, src/cli/commands/modules.ts:7-31)`
- `searchCommand (function, src/cli/commands/search.ts:6-55)`
- `symbolsCommand (function, src/cli/commands/symbols.ts:6-74)`
- `initCommand (function, src/cli/commands/init.ts:18-224)`
- `serveCommand (function, src/cli/commands/serve.ts:6-18)`
- `statusCommand (function, src/cli/commands/status.ts:10-121)`
- `updateCommand (function, src/cli/commands/update.ts:21-166)`

## Dependencies
- Imports from: utils, types, core, git, extraction, mcp

## Temporal Signals
- **Churn:** 4 changes (moderate)
- **Coupled with:** src/cli/commands/update.ts (4 co-changes, 100%), src/extraction/calls.ts (3 co-changes, 75%), src/extraction/imports.ts (3 co-changes, 75%), src/extraction/parser.ts (3 co-changes, 75%), src/extraction/symbols.ts (3 co-changes, 75%), tsup.config.ts (3 co-changes, 75%), src/extraction/calls.ts (3 co-changes, 75%), src/extraction/imports.ts (3 co-changes, 75%), src/extraction/parser.ts (3 co-changes, 75%), src/extraction/symbols.ts (3 co-changes, 75%), tsup.config.ts (3 co-changes, 75%), src/core/discovery.ts (3 co-changes, 75%), src/git/temporal.ts (3 co-changes, 75%), src/core/discovery.ts (3 co-changes, 75%), src/git/temporal.ts (3 co-changes, 75%)
- **Stability:** moderate
- **Last changed:** 2026-03-02T18:25:55+05:30
