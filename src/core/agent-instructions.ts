import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile, writeFile as writeFileFs } from 'node:fs/promises'
import { writeFile, ensureDir, cortexPath } from '../utils/files.js'

const CODECORTEX_SECTION_MARKER = '## CodeCortex'

export const AGENT_INSTRUCTIONS = `# CodeCortex — Codebase Navigation & Risk Tools

This project uses CodeCortex. It gives you a pre-built map of the codebase — architecture, dependencies, risk areas, hidden coupling. Use it to navigate to the right files, then read those files with your normal tools.

**CodeCortex finds WHERE to look. You still read the code.**

## Navigation (start here)
- \`get_project_overview\` — architecture, modules, risk map. Call this first.
- \`search_knowledge\` — find where a function/class/type is DEFINED by name. Ranked results: exported definitions first. NOT for content search — use grep for that.
- \`lookup_symbol\` — precise symbol lookup with kind + file path filters. Use when you know exactly what you're looking for (e.g., "all interfaces in gateway/").
- \`get_module_context\` — what files, symbols, and deps are in a specific module.
- \`get_dependency_graph\` — import/export graph filtered by file or module.
- \`get_session_briefing\` — what changed since the last session.

## When to use grep instead
- "How does X work?" → grep (searches file contents)
- "Find all usage of X" → grep (finds every occurrence)
- "Where is X defined?" → \`search_knowledge\` or \`lookup_symbol\` (finds definitions, ranked)

## Before Editing (ALWAYS call these)
- \`get_edit_briefing\` — co-change risks, hidden dependencies, bug history for files you plan to edit. Prevents bugs from files that secretly change together.
- \`get_change_coupling\` — files that historically change together. Missing one causes bugs.
- \`get_hotspots\` — files ranked by risk (churn + coupling + bugs).

## Response Detail Control
Most tools accept \`detail: "brief"\` (default) or \`"full"\`. Use brief for exploration, full only when you need exhaustive data.

## Building Knowledge (call as you work)
- \`record_decision\` — when you make a non-obvious technical choice, record WHY.
- \`update_patterns\` — when you discover a coding convention, document it.
- \`record_observation\` — record anything you learned (gotchas, undocumented deps, env requirements).
- \`get_decision_history\` — check what decisions were already made and why.
`

const CLAUDEMD_POINTER = `
${CODECORTEX_SECTION_MARKER}
This project uses CodeCortex for codebase knowledge. See \`.codecortex/AGENT.md\` for available MCP tools and when to use them.
`

// All known agent instruction files across AI coding tools
const AGENT_CONFIG_FILES = [
  'CLAUDE.md',           // Claude Code, Claude Desktop
  '.cursorrules',        // Cursor
  '.windsurfrules',      // Windsurf
  'AGENTS.md',           // Generic / multi-agent convention
  '.github/copilot-instructions.md', // GitHub Copilot
]

export async function generateAgentInstructions(projectRoot: string): Promise<string[]> {
  // 1. Write .codecortex/AGENT.md (canonical source of truth)
  await ensureDir(cortexPath(projectRoot))
  await writeFile(cortexPath(projectRoot, 'AGENT.md'), AGENT_INSTRUCTIONS)

  // 2. Append pointer to every agent config file that exists
  //    If NONE exist, create CLAUDE.md as default
  const updated: string[] = ['AGENT.md']
  let foundAny = false

  for (const file of AGENT_CONFIG_FILES) {
    const filePath = join(projectRoot, file)
    if (existsSync(filePath)) {
      foundAny = true
      const wasUpdated = await appendPointerToFile(filePath)
      if (wasUpdated) updated.push(file)
    }
  }

  // If no agent config files exist at all, create CLAUDE.md as default
  if (!foundAny) {
    await appendPointerToFile(join(projectRoot, 'CLAUDE.md'))
    updated.push('CLAUDE.md')
  }

  return updated
}

async function appendPointerToFile(filePath: string): Promise<boolean> {
  // Ensure parent directory exists (for .github/copilot-instructions.md)
  const dir = join(filePath, '..')
  if (!existsSync(dir)) {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dir, { recursive: true })
  }

  if (existsSync(filePath)) {
    const content = await readFileFs(filePath, 'utf-8')
    // Don't duplicate — check if CodeCortex section already exists
    if (content.includes(CODECORTEX_SECTION_MARKER)) return false
    await writeFileFs(filePath, content + CLAUDEMD_POINTER, 'utf-8')
    return true
  } else {
    // Create new file with just the pointer
    await writeFileFs(filePath, CLAUDEMD_POINTER.trimStart(), 'utf-8')
    return true
  }
}

async function readFileFs(path: string, encoding: BufferEncoding): Promise<string> {
  return readFile(path, encoding)
}
