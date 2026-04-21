# CodeCortex

Persistent codebase knowledge layer for AI agents. Pre-builds architecture, dependency, coupling, and risk knowledge so agents skip the cold start and go straight to the right files.

## Stack
- TypeScript, ESM (`"type": "module"`)
- tree-sitter (native N-API) + 27 language grammar packages
- @modelcontextprotocol/sdk - MCP server (stdio transport)
- commander - CLI (init, serve, update, inject, status, symbols, search, modules, hotspots, hook, upgrade)
- simple-git - git integration + temporal analysis
- zod - schema validation for LLM analysis results
- yaml - cortex.yaml manifest
- glob - file discovery

## Architecture

Three-tier knowledge storage in `.codecortex/` flat files:
- **HOT** (always loaded): cortex.yaml, constitution.md, overview.md, graph.json, symbols.json, temporal.json
- **WARM** (per-module): modules/*.md
- **COLD** (on-demand): decisions/*.md, sessions/*.md, patterns.md

Hybrid extraction:
- **Tree-sitter native N-API** → symbols (name, kind, signature, startLine, endLine, exported), imports, exports, call edges
- **Host LLM** → module summaries, decisions, patterns, session diffs

## Six Knowledge Layers
1. Structural (graph.json + symbols.json) - modules, deps, entry points, symbol index
2. Semantic (modules/*.md) - what each module DOES
3. Temporal (temporal.json) - git co-change coupling, hotspots, bug archaeology
4. Decisions (decisions/*.md) - WHY things are built this way
5. Patterns (patterns.md) - HOW code is written here
6. Sessions (sessions/*.md) - what CHANGED between sessions

## Scripts
- `npm run dev` - watch mode development
- `npm run build` - tsup build to dist/
- `npm run test` - vitest
- `npm run lint` - tsc --noEmit

## CLI
- `codecortex init` - discover + extract + temporal analysis → write .codecortex/
- `codecortex serve` - start MCP server
- `codecortex update` - re-extract changed files → update modules
- `codecortex status` - knowledge freshness, stale modules, symbol counts
- `codecortex symbols [query]` - browse and filter the symbol index
- `codecortex search <query>` - search across all knowledge files
- `codecortex modules [name]` - list modules or deep-dive into one
- `codecortex inject` - regenerate inline context in CLAUDE.md and agent config files
- `codecortex hotspots` - files ranked by risk (churn + coupling + bugs)
- `codecortex hook install|uninstall|status` - manage git hooks for auto-update
- `codecortex upgrade` - check for and install latest version

## MCP Tools (5)
get_project_overview, get_dependency_graph, lookup_symbol, get_change_coupling, get_edit_briefing

## MCP Resources (3)
- `codecortex://project/overview` — constitution (architecture, risk map)
- `codecortex://project/hotspots` — risk-ranked files
- `codecortex://module/{name}` — module documentation (template)

## MCP Prompts (2)
- `start_session` — constitution + latest session for context
- `before_editing` — risk assessment for files you plan to edit

All tools include `_freshness` metadata (status, lastAnalyzed, filesChangedSince, changedFiles, message).
All tools return context-safe responses (<10K chars) via truncation utilities in `src/utils/truncate.ts`.

## Pre-Publish Checklist
Run ALL of these before `npm publish`. Do not skip any step.
1. `npx tsc --noEmit` — must be clean
2. `npm run build` — must succeed
3. `npm test` — all tests must pass (grammar smoke test loads every language)
4. `node dist/cli/index.js --version` — verify version matches package.json
5. `node dist/cli/index.js --help` — verify grouped help renders correctly
6. `node dist/cli/index.js hook --help` — verify subcommand help is flat (not grouped)
7. `npm pack --dry-run` — verify tarball contents (no stale files, no secrets)
8. Verify version is bumped in BOTH `package.json` AND `src/mcp/server.ts`
9. If adding/removing a language: update count in README, CLAUDE.md, site/

### What the tests catch
- **Grammar smoke test** (`parser.test.ts`): Loads every language in `LANGUAGE_LOADERS` via `parseSource()`. Catches missing packages, broken native builds, wrong require paths. This is what would have caught the tree-sitter-liquid issue.
- **Version-check tests**: Update notification, cache lifecycle, PM detection, upgrade commands.
- **Hook tests**: Git hook install/uninstall/status integration tests.
- **MCP tests**: All 5 tools, resources, prompts, simulation tests.

### Known limitations
- tree-sitter native bindings don't compile on Node 24 yet (upstream issue)
- Some grammar packages need `--legacy-peer-deps` due to peer dep mismatches with tree-sitter@0.25
- Grammar smoke test skips NODE_MODULE_VERSION and "Invalid language object" errors (native binding issues, not code bugs)

## Key Patterns
- All MCP tool handlers return `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`
- Use stderr for logging (stdout reserved for JSON-RPC in stdio mode)
- All file paths in .codecortex/ are relative to project root
- Zod schemas validate LLM analysis input before persisting
- Discovery respects .gitignore via git ls-files

## Directory Structure
```
src/
  cli/           - commander CLI (init, serve, update, status)
  mcp/           - MCP server + tools
  core/          - knowledge store (graph, modules, decisions, sessions, patterns, constitution, search, agent-instructions, context-injection, freshness)
  extraction/    - tree-sitter native N-API (parser, symbols, imports, calls)
  git/           - git diff, history, temporal analysis
  types/         - TypeScript types + Zod schemas
  utils/         - file I/O, YAML, markdown helpers, truncation
```

## Temporal Analysis
- Change coupling: file pairs that co-change (hidden deps not in import graph)
- Hotspots: files ranked by change frequency (high churn = risky)
- Bug archaeology: fix/bug commit messages → learned lessons per module
- Stability signals: days since last change, change velocity per file

<!-- codecortex:start -->
## CodeCortex — Project Knowledge (auto-updated)

### Architecture
**codecortex-ai** — typescript — 70 files, 1557 symbols
- **Modules (7):** core (1697loc), cli (1661loc), extraction (1149loc), mcp (590loc), git (440loc), utils (283loc), types (228loc)
- **Entry points:** `dist/cli/index.js`
- **Key deps:** node:path, node:fs, simple-git, node:child_process, commander, +9 more

### Risk Map
**High-risk files:**
- `README.md` — 17 changes, 4 bug-fixes, moderate
- `src/mcp/server.ts` — 14 changes, 4 bug-fixes, moderate, coupled to: read.ts, init.ts ⚠
- `CLAUDE.md` — 13 changes, 4 bug-fixes, volatile
- `src/cli/commands/init.ts` — 9 changes, 1 bug-fixes, volatile, coupled to: update.ts ⚠, constitution.ts
- `src/cli/commands/update.ts` — 7 changes, moderate, coupled to: init.ts ⚠, temporal.ts

**Hidden couplings (co-change, no import):**
- `src/cli/commands/init.ts` ↔ `src/cli/commands/update.ts` (78% co-change)
- `src/mcp/tools/read.ts` ↔ `src/mcp/tools/write.ts` (67% co-change)
- `src/core/agent-instructions.ts` ↔ `src/mcp/tools/read.ts` (50% co-change)

### Before Editing
Check `.codecortex/hotspots.md` for risk-ranked files before editing.
Read `.codecortex/modules/<module>.md` for the relevant module's dependencies and bug history.

### Project Knowledge
Read these files directly (always available, no tool call needed):
- `.codecortex/hotspots.md` — risk-ranked files with coupling + bug data
- `.codecortex/modules/*.md` — module docs, dependencies, temporal signals
- `.codecortex/constitution.md` — full architecture overview
- `.codecortex/patterns.md` — coding conventions
- `.codecortex/decisions/*.md` — architectural decisions

<!-- codecortex:end -->
