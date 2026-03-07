# CodeCortex

Persistent codebase knowledge layer for AI agents. Your AI shouldn't re-learn your codebase every session.

> **⚠️ If you're on v0.4.3 or earlier, update now:** `npm install -g codecortex-ai@latest`
> v0.4.4 adds freshness flags on all MCP responses and `get_edit_briefing` — a pre-edit risk briefing tool.

[Website](https://codecortex-ai.vercel.app) · [npm](https://www.npmjs.com/package/codecortex-ai) · [GitHub](https://github.com/rushikeshmore/CodeCortex)

<a href="https://glama.ai/mcp/servers/@rushikeshmore/codecortex">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@rushikeshmore/codecortex/badge" alt="codecortex MCP server" />
</a>

## The Problem

Every AI coding session starts from scratch. When context compacts or a new session begins, the AI re-scans the entire codebase. Same files, same tokens, same wasted time. It's like hiring a new developer every session who has to re-learn everything before writing a single line.

**The data backs this up:**
- AI agents increase defect risk by 30% on unfamiliar code ([CodeScene + Lund University, 2025](https://codescene.com/hubfs/whitepapers/AI-Ready-Code-How-Code-Health-Determines-AI-Performance.pdf))
- Code churn grew 2.5x in the AI era ([GitClear, 211M lines analyzed](https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality))
- Nobody combines structural + semantic + temporal + decision knowledge in one portable tool

## The Solution

CodeCortex pre-digests codebases into layered knowledge files and serves them to any AI agent via MCP. Instead of re-understanding your codebase every session, the AI starts with knowledge.

**Hybrid extraction:** tree-sitter native N-API for structure (symbols, imports, calls across 27 languages) + host LLM for semantics (what modules do, why they're built that way). Zero extra API keys.

## Quick Start

> **Requires Node 20 or 22.** Node 24 is not yet supported (tree-sitter native bindings need an upstream update).

```bash
# Install (--legacy-peer-deps needed for tree-sitter peer dep mismatches)
npm install -g codecortex-ai --legacy-peer-deps

# Initialize knowledge for your project
cd /path/to/your-project
codecortex init

# Start MCP server (for AI agent access)
codecortex serve

# Check knowledge freshness
codecortex status
```

### Connect to Claude Code

Add to your MCP config:

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
  modules/*.md         # per-module deep analysis
  decisions/*.md       # architectural decision records
  sessions/*.md        # session change logs
  patterns.md          # coding patterns and conventions
```

## Six Knowledge Layers

| Layer | What | File |
|-------|------|------|
| 1. Structural | Modules, deps, symbols, entry points | `graph.json` + `symbols.json` |
| 2. Semantic | What each module does, data flow, gotchas | `modules/*.md` |
| 3. Temporal | Git behavioral fingerprint - coupling, hotspots, bug history | `temporal.json` |
| 4. Decisions | Why things are built this way | `decisions/*.md` |
| 5. Patterns | How code is written here | `patterns.md` |
| 6. Sessions | What changed between sessions | `sessions/*.md` |

### The Temporal Layer

This is the killer differentiator. The temporal layer tells agents *"if you touch file X, you MUST also touch file Y"* even when there's no import between them. This comes from git co-change analysis, not static code analysis.

Example from a real codebase:
- `routes.ts` and `worker.ts` co-changed in 9/12 commits (75%) with **zero imports between them**
- Without this knowledge, an AI editing one file would produce a bug 75% of the time

## MCP Tools (15)

### Read Tools (10)

| Tool | Description |
|------|-------------|
| `get_project_overview` | Constitution + overview + graph summary |
| `get_module_context` | Module doc by name, includes temporal signals |
| `get_session_briefing` | Changes since last session |
| `search_knowledge` | Keyword search across all knowledge |
| `get_decision_history` | Decision records filtered by topic |
| `get_dependency_graph` | Import/export graph, filterable |
| `lookup_symbol` | Symbol by name/file/kind |
| `get_change_coupling` | What files must I also edit if I touch X? |
| `get_hotspots` | Files ranked by risk (churn x coupling) |
| `get_edit_briefing` | **NEW** — Pre-edit risk briefing: co-change warnings, hidden deps, bug history, importers |

All read tools include `_freshness` metadata indicating how up-to-date the knowledge is.

### Write Tools (5)

| Tool | Description |
|------|-------------|
| `analyze_module` | Returns source files + structured prompt for LLM analysis |
| `save_module_analysis` | Persists LLM analysis to `modules/*.md` |
| `record_decision` | Saves architectural decision to `decisions/*.md` |
| `update_patterns` | Merges coding pattern into `patterns.md` |
| `report_feedback` | Agent reports incorrect knowledge for next analysis |

## CLI Commands

| Command | Description |
|---------|-------------|
| `codecortex init` | Discover project + extract symbols + analyze git history |
| `codecortex serve` | Start MCP server (stdio transport) |
| `codecortex update` | Re-extract changed files, update affected modules |
| `codecortex status` | Show knowledge freshness, stale modules, symbol counts |
| `codecortex symbols [query]` | Browse and filter the symbol index |
| `codecortex search <query>` | Search across all CodeCortex knowledge files |
| `codecortex modules [name]` | List modules or deep-dive into a specific module |
| `codecortex hotspots` | Show files ranked by risk: churn + coupling + bug history |
| `codecortex hook install\|uninstall\|status` | Manage git hooks for auto-updating knowledge |
| `codecortex upgrade` | Check for and install the latest version |

## Token Efficiency

CodeCortex uses a three-tier memory model to minimize token usage:

```
Session start (HOT only):           ~4,300 tokens
Working on a module (+WARM):         ~5,000 tokens
Need coding patterns (+COLD):        ~5,900 tokens

vs. raw scan of entire codebase:    ~37,800 tokens
```

85-90% token reduction. 7-10x efficiency gain.

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
