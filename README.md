# CodeCortex

Persistent codebase knowledge layer for AI agents. Pre-builds architecture, dependencies, coupling, and risk knowledge so agents skip the cold start and go straight to the right files.

[![CI](https://github.com/rushikeshmore/CodeCortex/actions/workflows/ci.yml/badge.svg)](https://github.com/rushikeshmore/CodeCortex/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/codecortex-ai)](https://www.npmjs.com/package/codecortex-ai)
[![npm downloads](https://img.shields.io/npm/dw/codecortex-ai)](https://www.npmjs.com/package/codecortex-ai)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/rushikeshmore/CodeCortex/badge)](https://scorecard.dev/viewer/?uri=github.com/rushikeshmore/CodeCortex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rushikeshmore/CodeCortex/blob/main/LICENSE)

[Website](https://codecortex-ai.vercel.app) · [npm](https://www.npmjs.com/package/codecortex-ai) · [GitHub](https://github.com/rushikeshmore/CodeCortex)

<a href="https://glama.ai/mcp/servers/@rushikeshmore/codecortex">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@rushikeshmore/codecortex/badge" alt="codecortex MCP server" />
</a>

## The Problem

Every AI coding session starts with exploration — grepping, reading wrong files, re-discovering architecture. On a 6,000-file codebase, an agent makes 37 tool calls and burns 79K tokens just to understand what's where. And it still can't tell you which files are dangerous to edit or which files secretly depend on each other.

**The data backs this up:**
- AI agents increase defect risk by 30% on unfamiliar code ([CodeScene + Lund University, 2025](https://codescene.com/hubfs/whitepapers/AI-Ready-Code-How-Code-Health-Determines-AI-Performance.pdf))
- Code churn grew 2.5x in the AI era ([GitClear, 211M lines analyzed](https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality))

## The Solution

CodeCortex eliminates the cold start. It pre-builds codebase knowledge — architecture, dependencies, risk areas, hidden coupling — so agents skip the exploration phase and go straight to the right files.

**Not a middleware. Not a proxy. Just knowledge your agent loads on day one.**

Tested on a real 6,400-file codebase (143K symbols, 96 modules):

| | Without CodeCortex | With CodeCortex |
|--|:--:|:--:|
| Tool calls | 37 | **15** (2.5x fewer) |
| Total tokens | 79K | **43K** (~50% fewer) |
| Answer quality | 23/25 | **23/25** (same) |
| Hidden dependencies found | No | **Yes** |

### What makes it unique

Three capabilities no other tool provides:

1. **Temporal coupling** — Files that always change together but have zero imports between them. You can read every line and never discover this. Only git co-change analysis reveals it.

2. **Risk scores** — File X has been bug-fixed 7 times, has 6 hidden dependencies, and co-changes with 3 other files. Risk score: 35. You can't learn this from reading code.

3. **Cross-session memory** — Decisions, patterns, observations persist. The agent doesn't start from zero each session.

**Example from a real codebase:**
- `schema.help.ts` and `schema.labels.ts` co-changed in 12/14 commits (86%) with **zero imports between them**
- Without this knowledge, an AI editing one file would produce a bug 86% of the time

## Quick Start

> **Requires Node 20 or 22.** Node 24 is not yet supported (tree-sitter native bindings need an upstream update).

```bash
# Install (--legacy-peer-deps needed for tree-sitter peer dep mismatches)
npm install -g codecortex-ai --legacy-peer-deps

# Initialize knowledge for your project
cd /path/to/your-project
codecortex init

# Check knowledge freshness
codecortex status
```

### Connect to Claude Code

**CLI (recommended):**
```bash
claude mcp add codecortex -- codecortex serve
```

**Or add to MCP config manually:**
```json
{
  "mcpServers": {
    "codecortex": {
      "command": "codecortex",
      "args": ["serve"],
      "cwd": "/path/to/your-project"
    }
  }
}
```

### Connect to Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "codecortex": {
      "command": "codecortex",
      "args": ["serve"],
      "cwd": "/path/to/your-project"
    }
  }
}
```

## What Gets Generated

All knowledge lives in `.codecortex/` as flat files in your repo:

```
.codecortex/
  cortex.yaml          # project manifest
  constitution.md      # project overview for agents
  overview.md          # module map + entry points
  graph.json           # dependency graph (imports, calls, modules)
  symbols.json         # full symbol index (functions, classes, types...)
  temporal.json        # git coupling, hotspots, bug history
  AGENT.md             # tool usage guide for AI agents
  modules/*.md         # per-module structural analysis
  decisions/*.md       # architectural decision records
  sessions/*.md        # session change logs
  patterns.md          # coding patterns and conventions
```

## Six Knowledge Layers

| Layer | What | File |
|-------|------|------|
| 1. Structural | Modules, deps, symbols, entry points | `graph.json` + `symbols.json` |
| 2. Semantic | What each module does, data flow, gotchas | `modules/*.md` |
| 3. Temporal | Git behavioral fingerprint — coupling, hotspots, bug history | `temporal.json` |
| 4. Decisions | Why things are built this way | `decisions/*.md` |
| 5. Patterns | How code is written here | `patterns.md` |
| 6. Sessions | What changed between sessions | `sessions/*.md` |

## MCP Tools (13)

### Navigation — "Where should I look?" (4 tools)

| Tool | Description |
|------|-------------|
| `get_project_overview` | Architecture, modules, risk map. Call this first. |
| `search_knowledge` | Find where a function/class/type is DEFINED by name. Ranked results. |
| `lookup_symbol` | Precise symbol lookup with kind and file path filters. |
| `get_module_context` | Module files, deps, temporal signals. Zoom into a module. |

### Risk — "What could go wrong?" (4 tools)

| Tool | Description |
|------|-------------|
| `get_edit_briefing` | Pre-edit risk: co-change warnings, hidden deps, bug history. **Always call before editing.** |
| `get_hotspots` | Files ranked by risk (churn x coupling x bugs). |
| `get_change_coupling` | Files that must change together. Hidden dependencies flagged. |
| `get_dependency_graph` | Import/export graph filtered by module or file. |

### Memory — "Remember this" (5 tools)

| Tool | Description |
|------|-------------|
| `get_session_briefing` | What changed since the last session. |
| `get_decision_history` | Why things were built this way. |
| `record_decision` | Save an architectural decision. |
| `update_patterns` | Document coding conventions. |
| `record_observation` | Record anything you learned about the codebase. |

All read tools include `_freshness` metadata and return context-safe responses (<10K chars) via size-adaptive caps.

## CLI Commands

| Command | Description |
|---------|-------------|
| `codecortex init` | Discover project + extract symbols + analyze git history |
| `codecortex serve` | Start MCP server (stdio transport) |
| `codecortex update` | Re-extract changed files, update affected modules |
| `codecortex status` | Show knowledge freshness, stale modules, symbol counts |
| `codecortex symbols [query]` | Browse and filter the symbol index |
| `codecortex search <query>` | Search across symbols, file paths, and docs |
| `codecortex modules [name]` | List modules or deep-dive into a specific module |
| `codecortex hotspots` | Show files ranked by risk: churn + coupling + bug history |
| `codecortex hook install\|uninstall\|status` | Manage git hooks for auto-updating knowledge |
| `codecortex upgrade` | Check for and install the latest version |

## How It Works

**Hybrid extraction:** tree-sitter native N-API for structure (symbols, imports, calls across 27 languages) + host LLM for semantics (what modules do, why they're built that way). Zero extra API keys.

**Git hooks** keep knowledge fresh — `codecortex update` runs automatically on every commit, re-extracting changed files and updating temporal analysis.

**Size-adaptive responses** — CodeCortex classifies your project (micro → extra-large) and adjusts response caps accordingly. A 23-file project gets full detail. A 6,400-file project gets intelligent summaries. Every MCP tool response stays under 10K chars.

## Supported Languages (27)

| Category | Languages |
|----------|-----------|
| Web | TypeScript, TSX, JavaScript |
| Systems | C, C++, Objective-C, Rust, Zig, Go |
| JVM | Java, Kotlin, Scala |
| .NET | C# |
| Mobile | Swift, Dart |
| Scripting | Python, Ruby, PHP, Lua, Bash, Elixir |
| Functional | OCaml, Elm, Emacs Lisp |
| Other | Solidity, Vue, CodeQL |

## Tech Stack

- TypeScript ESM, Node.js 20+
- `tree-sitter` (native N-API) + 27 language grammar packages
- `@modelcontextprotocol/sdk` - MCP server
- `commander` - CLI
- `simple-git` - git integration
- `yaml`, `zod`, `glob`

## License

MIT
