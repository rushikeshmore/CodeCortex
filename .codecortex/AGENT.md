# CodeCortex — Codebase Navigation & Risk Tools

This project uses CodeCortex. It gives you a pre-built map of the codebase — architecture, dependencies, risk areas, hidden coupling. Use it to navigate to the right files, then read those files with your normal tools.

**CodeCortex finds WHERE to look. You still read the code.**

## Navigation (start here)
- `get_project_overview` — architecture, modules, risk map. Call this first.
- `lookup_symbol` — precise symbol lookup with kind + file path filters. Use when you know exactly what you're looking for (e.g., "all interfaces in gateway/").
- `get_dependency_graph` — import/export graph filtered by file or module.

## When to use grep instead
- "How does X work?" → grep (searches file contents)
- "Find all usage of X" → grep (finds every occurrence)
- "Where is X defined?" → `lookup_symbol` (finds definitions with filters)

## Before Editing (ALWAYS call these)
- `get_edit_briefing` — co-change risks, hidden dependencies, bug history for files you plan to edit. Prevents bugs from files that secretly change together.
- `get_change_coupling` — files that historically change together. Missing one causes bugs.

## Static Knowledge (read directly, no tool needed)
- `.codecortex/modules/*.md` — module docs (purpose, deps, API)
- `.codecortex/hotspots.md` — files ranked by risk (churn + coupling + bugs)
- `.codecortex/patterns.md` — coding conventions
- `.codecortex/decisions/*.md` — architectural decision records

## Response Detail Control
Most tools accept `detail: "brief"` (default) or `"full"`. Use brief for exploration, full only when you need exhaustive data.
