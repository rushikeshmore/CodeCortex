# Module: git

## Purpose
3 files, 365 lines (typescript). Auto-generated from code structure — use `analyze_module` MCP tool for semantic analysis.

## Data Flow
Files: src/git/diff.ts, src/git/history.ts, src/git/temporal.ts

## Public API
- `DiffResult (interface, src/git/diff.ts:3-8)`
- `getUncommittedDiff (function, src/git/diff.ts:10-20)`
- `getDiffSinceCommit (function, src/git/diff.ts:22-32)`
- `getChangedFilesSinceDate (function, src/git/diff.ts:34-49)`
- `mapFilesToModules (function, src/git/diff.ts:51-70)`
- `CommitInfo (interface, src/git/history.ts:3-9)`
- `getCommitHistory (function, src/git/history.ts:11-28)`
- `getLastCommitDate (function, src/git/history.ts:35-43)`
- `isGitRepo (function, src/git/history.ts:45-53)`
- `getHeadCommit (function, src/git/history.ts:55-63)`
- `analyzeTemporalData (function, src/git/temporal.ts:17-32)`
- `getHotspots (function, src/git/temporal.ts:34-74)`
- `getChangeCoupling (function, src/git/temporal.ts:76-130)`
- `getBugArchaeology (function, src/git/temporal.ts:132-164)`
- `getStabilitySignals (function, src/git/temporal.ts:166-193)`
- `getEvolutionEvents (function, src/git/temporal.ts:195-229)`

## Dependencies
- Imports from: types
- Imported by: cli

## Temporal Signals
- **Churn:** 3 changes (moderate)
- **Coupled with:** src/cli/commands/init.ts (3 co-changes, 75%), src/cli/commands/update.ts (3 co-changes, 75%), src/core/discovery.ts (3 co-changes, 100%)
- **Stability:** moderate
- **Last changed:** 2026-03-02T13:22:57+05:30
