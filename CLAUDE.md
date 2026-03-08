# CodeCortex

Persistent codebase knowledge layer for AI agents. Pre-builds architecture, dependency, coupling, and risk knowledge so agents skip the cold start and go straight to the right files.

## Stack
- TypeScript, ESM (`"type": "module"`)
- tree-sitter (native N-API) + 27 language grammar packages
- @modelcontextprotocol/sdk - MCP server (stdio transport)
- commander - CLI (init, serve, update, status, symbols, search, modules, hotspots, hook, upgrade)
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
- `codecortex hotspots` - files ranked by risk (churn + coupling + bugs)
- `codecortex hook install|uninstall|status` - manage git hooks for auto-update
- `codecortex upgrade` - check for and install latest version

## MCP Tools (13)
Read (10): get_project_overview, get_module_context, get_session_briefing, search_knowledge, get_decision_history, get_dependency_graph, lookup_symbol, get_change_coupling, get_hotspots, get_edit_briefing
Write (3): record_decision, update_patterns, record_observation

All read tools include `_freshness` metadata (status, lastAnalyzed, filesChangedSince, changedFiles, message).
All read tools return context-safe responses (<10K chars) via truncation utilities in `src/utils/truncate.ts`.

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
- **MCP tests**: All 13 tools (read + write), simulation tests.

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
  core/          - knowledge store (graph, modules, decisions, sessions, patterns, constitution, search, agent-instructions, freshness)
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
