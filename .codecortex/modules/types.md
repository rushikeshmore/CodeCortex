# Module: types

## Purpose
2 files, 222 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/types/index.ts, src/types/schema.ts

## Public API
- `SymbolRecord (interface, src/types/index.ts:3-12)`
- `SymbolIndex (interface, src/types/index.ts:14-18)`
- `ImportEdge (interface, src/types/index.ts:22-26)`
- `CallEdge (interface, src/types/index.ts:30-35)`
- `ModuleNode (interface, src/types/index.ts:39-46)`
- `DependencyGraph (interface, src/types/index.ts:48-55)`
- `ChangeCoupling (interface, src/types/index.ts:59-66)`
- `Hotspot (interface, src/types/index.ts:68-74)`
- `BugRecord (interface, src/types/index.ts:76-80)`
- `TemporalData (interface, src/types/index.ts:82-89)`
- `ModuleAnalysis (interface, src/types/index.ts:93-107)`
- `DecisionRecord (interface, src/types/index.ts:111-120)`
- `SessionLog (interface, src/types/index.ts:124-132)`
- `CortexManifest (interface, src/types/index.ts:136-151)`
- `DiscoveredFile (interface, src/types/index.ts:155-161)`
- `ProjectInfo (interface, src/types/index.ts:163-171)`
- `FeedbackEntry (interface, src/types/index.ts:175-180)`
- `CodingPattern (interface, src/types/index.ts:184-189)`
- `ModuleAnalysisSchema (const, src/types/schema.ts:3-10)`
- `DecisionInputSchema (const, src/types/schema.ts:12-18)`
- `PatternInputSchema (const, src/types/schema.ts:20-25)`
- `FeedbackInputSchema (const, src/types/schema.ts:27-31)`

## Dependencies
- Imported by: cli, core, extraction, git, mcp, utils

## Temporal Signals
- **Churn:** 1 changes (stable)
- **Coupled with:** none
- **Stability:** stable
- **Last changed:** 2026-03-02T03:29:16+05:30
