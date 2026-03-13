import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generateAgentInstructions, AGENT_INSTRUCTIONS } from '../../src/core/agent-instructions.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'codecortex-agent-test-'))
  await mkdir(join(root, '.codecortex'), { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('generateAgentInstructions', () => {
  it('creates AGENT.md in .codecortex/', async () => {
    await generateAgentInstructions(root)

    const agentMd = await readFile(join(root, '.codecortex', 'AGENT.md'), 'utf-8')
    expect(agentMd).toBe(AGENT_INSTRUCTIONS)
  })

  it('creates CLAUDE.md with inline context when none exists', async () => {
    await generateAgentInstructions(root)

    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('## CodeCortex')
    expect(claudeMd).toContain('<!-- codecortex:start -->')
    expect(claudeMd).toContain('<!-- codecortex:end -->')
    expect(claudeMd).toContain('get_edit_briefing')
  })

  it('appends inline context to existing CLAUDE.md', async () => {
    await writeFile(join(root, 'CLAUDE.md'), '# My Project\n\nSome instructions.\n', 'utf-8')

    await generateAgentInstructions(root)

    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('# My Project')
    expect(claudeMd).toContain('Some instructions.')
    expect(claudeMd).toContain('<!-- codecortex:start -->')
    expect(claudeMd).toContain('get_edit_briefing')
  })

  it('is idempotent — does not duplicate on re-run', async () => {
    await generateAgentInstructions(root)
    await generateAgentInstructions(root)

    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf-8')
    const matches = claudeMd.match(/## CodeCortex/g)
    expect(matches).toHaveLength(1)
  })

  it('appends to .cursorrules if it exists', async () => {
    await writeFile(join(root, '.cursorrules'), '# Cursor rules\n', 'utf-8')

    await generateAgentInstructions(root)

    const cursorrules = await readFile(join(root, '.cursorrules'), 'utf-8')
    expect(cursorrules).toContain('# Cursor rules')
    expect(cursorrules).toContain('## CodeCortex')
  })

  it('appends to .windsurfrules if it exists', async () => {
    await writeFile(join(root, '.windsurfrules'), '# Windsurf rules\n', 'utf-8')

    await generateAgentInstructions(root)

    const windsurfrules = await readFile(join(root, '.windsurfrules'), 'utf-8')
    expect(windsurfrules).toContain('# Windsurf rules')
    expect(windsurfrules).toContain('## CodeCortex')
  })

  it('appends to AGENTS.md if it exists', async () => {
    await writeFile(join(root, 'AGENTS.md'), '# Agents config\n', 'utf-8')

    await generateAgentInstructions(root)

    const agentsMd = await readFile(join(root, 'AGENTS.md'), 'utf-8')
    expect(agentsMd).toContain('# Agents config')
    expect(agentsMd).toContain('## CodeCortex')
  })

  it('appends to .github/copilot-instructions.md if it exists', async () => {
    await mkdir(join(root, '.github'), { recursive: true })
    await writeFile(join(root, '.github/copilot-instructions.md'), '# Copilot\n', 'utf-8')

    await generateAgentInstructions(root)

    const copilot = await readFile(join(root, '.github/copilot-instructions.md'), 'utf-8')
    expect(copilot).toContain('# Copilot')
    expect(copilot).toContain('## CodeCortex')
  })

  it('returns list of updated files', async () => {
    await writeFile(join(root, '.cursorrules'), '# Cursor\n', 'utf-8')
    await writeFile(join(root, 'AGENTS.md'), '# Agents\n', 'utf-8')

    const updated = await generateAgentInstructions(root)

    expect(updated).toContain('AGENT.md')
    expect(updated).toContain('.cursorrules')
    expect(updated).toContain('AGENTS.md')
  })

  it('AGENT.md contains the 5 kept tool names', async () => {
    await generateAgentInstructions(root)

    const agentMd = await readFile(join(root, '.codecortex', 'AGENT.md'), 'utf-8')
    const expectedTools = [
      'get_project_overview', 'get_edit_briefing',
      'get_change_coupling', 'lookup_symbol',
      'get_dependency_graph',
    ]
    for (const tool of expectedTools) {
      expect(agentMd).toContain(tool)
    }

    // Dropped tools should NOT be in AGENT.md
    const droppedTools = [
      'search_knowledge', 'get_module_context',
      'get_hotspots', 'get_decision_history',
      'get_session_briefing', 'record_decision',
      'update_patterns', 'record_observation',
    ]
    for (const tool of droppedTools) {
      expect(agentMd).not.toContain(tool)
    }
  })
})
