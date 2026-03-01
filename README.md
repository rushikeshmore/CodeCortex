# CodeCortex

> Persistent, AI-powered codebase knowledge layer. You shouldn't have to restructure your codebase for AI — CodeCortex gives AI the understanding automatically.

## The Problem

Every AI coding session starts from scratch. When context compacts or a new session begins, the AI must re-scan the entire codebase — same files, same tokens, same time. It's like hiring a new developer every session who has to re-learn your entire codebase before writing a single line.

**The data backs this up:**
- AI agents increase defect risk by 30% on unfamiliar code ([CodeScene + Lund University, 2025](https://codescene.com/hubfs/whitepapers/AI-Coding-Assistants-and-Code-Quality.pdf))
- Code churn grew 2.5x in the AI era ([GitClear, 211M lines analyzed](https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality))
- Nobody combines structural + semantic + temporal + decision knowledge in one portable tool

## The Solution

CodeCortex pre-digests codebases into layered, structured knowledge files and serves them to any AI agent via MCP. Instead of re-understanding your codebase every session, the AI starts with knowledge.

**Hybrid extraction:** tree-sitter WASM for precise structure (symbols, imports, calls) + host LLM for rich semantics (what modules do, why they're built that way). Zero extra API keys. Language-agnostic from day 1.

## Quick Start

```bash
# Install
npm install -g codecortex

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

## Architecture

```
ANY AI AGENT (Claude Code, Cursor, Codex, Windsurf, Zed)
       │
  MCP Protocol (stdio)
       │
┌──────▼──────────────────────────────────────────────┐
│         CODECORTEX MCP SERVER (14 tools)             │
│  READ (9): overview │ module │ briefing │ search │   │
│            decisions │ graph │ lookup_symbol │        │
│            change_coupling │ hotspots                │
│  WRITE (5): analyze_module │ save_analysis │         │
│             record_decision │ update_patterns │      │
│             report_feedback                          │
└──────┬──────────────────────────────────────────────┘
       │ reads/writes
┌──────▼──────────────────────────────────────────────┐
│            .codecortex/ (flat files in repo)          │
│  HOT: cortex.yaml │ constitution.md │ overview.md    │
│       graph.json │ symbols.json │ temporal.json      │
│  WARM: modules/*.md                                  │
│  COLD: decisions/*.md │ sessions/*.md │ patterns.md  │
└──────────────────────────────────────────────────────┘
```

## Six Knowledge Layers

| Layer | What | File |
|-------|------|------|
| 1. Structural | Modules, deps, symbols, entry points | `graph.json` + `symbols.json` |
| 2. Semantic | What each module DOES, data flow, gotchas | `modules/*.md` |
| 3. Temporal | Git behavioral fingerprint — coupling, hotspots, bug history | `temporal.json` |
| 4. Decisions | WHY things are built this way | `decisions/*.md` |
| 5. Patterns | HOW code is written here | `patterns.md` |
| 6. Sessions | What CHANGED between sessions | `sessions/*.md` |

### The Temporal Layer — Our Killer Differentiator

The temporal layer tells agents *"if you touch file X, you MUST also touch file Y"* even when there's no import between them. This comes from git co-change analysis, not static code analysis.

Example from a real codebase:
- `routes.ts` ↔ `worker.ts` co-changed 9/12 commits (75%) — **zero imports between them**
- Without this knowledge, an AI editing one file would produce a bug 75% of the time

## MCP Tools

### Read Tools (9)

| Tool | Description | Tier |
|------|-------------|------|
| `get_project_overview` | Constitution + overview + graph summary | HOT |
| `get_module_context` | Module doc by name, includes temporal signals | WARM |
| `get_session_briefing` | Changes since last session | COLD |
| `search_knowledge` | Keyword search across all knowledge | COLD |
| `get_decision_history` | Decision records filtered by topic | COLD |
| `get_dependency_graph` | Import/export graph, filterable | HOT |
| `lookup_symbol` | Symbol by name/file/kind | HOT |
| `get_change_coupling` | "What files must I also edit if I touch X?" | HOT |
| `get_hotspots` | Files ranked by risk (churn × coupling) | HOT |

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

## Progressive Disclosure

CodeCortex uses a three-tier memory model to minimize token usage:

```
Session start (HOT only):           ~4,300 tokens  ← full codebase understanding
Working on a module (+WARM):         ~5,000 tokens  ← deep module knowledge
Need coding patterns (+COLD):        ~5,900 tokens  ← every pattern + gotcha

vs. raw scan of entire codebase:    ~37,800 tokens  ← and still might miss things
```

**Result: 85-90% token reduction, 80-85% fewer tool calls, 7-10x efficiency multiplier.**

## Supported Languages

Tree-sitter WASM grammars ship for:
- TypeScript / JavaScript
- Python
- Go
- Rust

More languages can be added via `.scm` query files.

## Tech Stack

- TypeScript ESM, Node.js 20+
- `web-tree-sitter` + `tree-sitter-wasms` — WASM extraction, zero native compilation
- `@modelcontextprotocol/sdk` — MCP server
- `commander` — CLI
- `simple-git` — git integration
- `yaml`, `zod`, `glob`, `chokidar`

## License

MIT
