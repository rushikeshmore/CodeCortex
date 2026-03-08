import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile, writeFile as writeFileFs } from 'node:fs/promises'
import { writeFile, ensureDir, cortexPath } from '../utils/files.js'

const CODECORTEX_SECTION_MARKER = '## CodeCortex'

export const AGENT_INSTRUCTIONS = `# CodeCortex — Codebase Knowledge Tools

This project uses CodeCortex for persistent codebase knowledge. These MCP tools give you pre-analyzed context — prefer them over raw Read/Grep/Glob.

## Orientation (start here)
- \`get_project_overview\` — architecture, modules, risk map. Call this first.
- \`search_knowledge\` — search functions, types, files, and docs by keyword. Faster than grep for concepts.

## Before Editing (ALWAYS call these)
- \`get_edit_briefing\` — co-change risks, hidden dependencies, bug history for files you plan to edit.
- \`get_change_coupling\` — files that historically change together. Missing one causes bugs.
- \`lookup_symbol\` — find where a function/class/type is defined.

## Deep Dive
- \`get_module_context\` — purpose, API, gotchas, and dependencies of a specific module.
- \`get_dependency_graph\` — import/export graph filtered by file or module.
- \`get_hotspots\` — files ranked by risk (churn + coupling + bugs).
- \`get_decision_history\` — architectural decisions and their rationale.
- \`get_session_briefing\` — what changed since the last session.

## Response Detail Control
These tools accept a \`detail\` parameter (\`"brief"\` or \`"full"\`): \`get_module_context\`, \`get_dependency_graph\`, \`get_decision_history\`, \`lookup_symbol\`, \`get_change_coupling\`, \`search_knowledge\`, \`get_edit_briefing\`.
- **brief** (default) — size-adaptive caps. Small projects show more, large projects truncate aggressively. Best for exploration.
- **full** — returns complete data up to hard safety limits. Use when you need exhaustive info for a specific analysis.
Only use \`detail: "full"\` when brief results are insufficient — it increases response size significantly on large codebases.

## Building Knowledge (call as you work)
- \`record_decision\` — when you make a non-obvious technical choice, record WHY.
- \`update_patterns\` — when you discover a coding convention, document it.
- \`analyze_module\` + \`save_module_analysis\` — deep-analyze a module's purpose and API.
- \`report_feedback\` — if any CodeCortex knowledge is wrong or outdated, report it.
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
