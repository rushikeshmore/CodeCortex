import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { generateInlineContext, injectIntoFile, injectAllAgentFiles, detectMcpConfigured } from '../../src/core/context-injection.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'codecortex-inject-test-'))
  await mkdir(join(root, '.codecortex'), { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('generateInlineContext', () => {
  it('produces sections even with no data', async () => {
    const content = await generateInlineContext(root)

    expect(content).toContain('<!-- codecortex:start -->')
    expect(content).toContain('<!-- codecortex:end -->')
    expect(content).toContain('## CodeCortex')
    expect(content).toContain('### Before Editing')
    expect(content).toContain('### Project Knowledge')
  })

  it('omits MCP Tools section when no MCP config detected', async () => {
    const content = await generateInlineContext(root)

    expect(content).not.toContain('### MCP Tools')
    expect(content).not.toContain('get_edit_briefing')
    expect(content).toContain('Read `.codecortex/modules/<module>.md`')
  })

  it('includes MCP Tools section when mcpConfigured option is true', async () => {
    const content = await generateInlineContext(root, { mcpConfigured: true })

    expect(content).toContain('### MCP Tools')
    expect(content).toContain('CodeCortex MCP server is configured')
    expect(content).toContain('Call `get_edit_briefing`')
  })

  it('omits missing knowledge files from Project Knowledge section', async () => {
    const content = await generateInlineContext(root)

    // No .codecortex files exist in this test root, so Project Knowledge has no bullets
    const knowledgeIdx = content.indexOf('### Project Knowledge')
    expect(knowledgeIdx).toBeGreaterThan(-1)
    const knowledgeSection = content.slice(knowledgeIdx)
    expect(knowledgeSection).not.toContain('- `.codecortex/hotspots.md`')
    expect(knowledgeSection).not.toContain('- `.codecortex/modules/*.md`')
    expect(knowledgeSection).not.toContain('- `.codecortex/constitution.md`')
    expect(knowledgeSection).not.toContain('- `.codecortex/patterns.md`')
    expect(knowledgeSection).not.toContain('- `.codecortex/decisions/*.md`')
  })

  it('skips empty patterns.md in Project Knowledge section', async () => {
    await writeFile(join(root, '.codecortex', 'hotspots.md'), '# Risk', 'utf-8')
    await writeFile(join(root, '.codecortex', 'patterns.md'), '', 'utf-8')

    const content = await generateInlineContext(root)
    const knowledgeSection = content.slice(content.indexOf('### Project Knowledge'))

    expect(knowledgeSection).toContain('- `.codecortex/hotspots.md`')
    expect(knowledgeSection).not.toContain('- `.codecortex/patterns.md`')
  })

  it('includes populated patterns.md in Project Knowledge section', async () => {
    await writeFile(join(root, '.codecortex', 'patterns.md'), '# Patterns\n\nUse X for Y.', 'utf-8')

    const content = await generateInlineContext(root)
    const knowledgeSection = content.slice(content.indexOf('### Project Knowledge'))

    expect(knowledgeSection).toContain('- `.codecortex/patterns.md`')
  })

  it('auto-detects MCP from .mcp.json in project root', async () => {
    await writeFile(
      join(root, '.mcp.json'),
      JSON.stringify({ mcpServers: { codecortex: { command: 'codecortex', args: ['mcp'] } } }),
      'utf-8'
    )

    const content = await generateInlineContext(root)

    expect(content).toContain('### MCP Tools')
    expect(content).toContain('get_edit_briefing')
  })

  it('includes architecture when manifest exists', async () => {
    const manifest = {
      version: '1.0.0',
      project: 'test-project',
      root: '.',
      generated: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      languages: ['typescript', 'python'],
      totalFiles: 42,
      totalSymbols: 500,
      totalModules: 5,
      projectSize: 'small',
      tiers: { hot: [], warm: [], cold: [] },
    }
    await writeFile(join(root, '.codecortex', 'cortex.yaml'), JSON.stringify(manifest), 'utf-8')

    // Write a minimal manifest that readManifest can parse
    const { writeManifest, createManifest } = await import('../../src/core/manifest.js')
    await writeManifest(root, createManifest({
      project: 'test-project',
      languages: ['typescript', 'python'],
      totalFiles: 42,
      totalSymbols: 500,
      totalModules: 5,
    }))

    const content = await generateInlineContext(root)

    expect(content).toContain('### Architecture')
    expect(content).toContain('test-project')
    expect(content).toContain('typescript')
  })

  it('includes risk map when temporal data exists', async () => {
    const temporal = {
      generated: new Date().toISOString(),
      periodDays: 90,
      totalCommits: 50,
      hotspots: [
        { file: 'src/main.ts', changes: 12, stability: 'volatile', lastChanged: new Date().toISOString(), daysSinceChange: 1 },
      ],
      coupling: [
        { fileA: 'src/a.ts', fileB: 'src/b.ts', cochanges: 5, strength: 0.75, hasImport: false },
      ],
      bugHistory: [
        { file: 'src/main.ts', fixCommits: 3, lessons: ['fixed crash'] },
      ],
    }
    await writeFile(join(root, '.codecortex', 'temporal.json'), JSON.stringify(temporal), 'utf-8')

    const content = await generateInlineContext(root)

    expect(content).toContain('### Risk Map')
    expect(content).toContain('src/main.ts')
    expect(content).toContain('12 changes')
    expect(content).toContain('3 bug-fixes')  // Bug count shown inline with hotspot
    expect(content).toContain('src/a.ts')
    expect(content).toContain('75% co-change')
  })

  it('includes all 5 tool names when MCP configured', async () => {
    const content = await generateInlineContext(root, { mcpConfigured: true })

    expect(content).toContain('get_project_overview')
    expect(content).toContain('get_dependency_graph')
    expect(content).toContain('lookup_symbol')
    expect(content).toContain('get_change_coupling')
    expect(content).toContain('get_edit_briefing')
  })

  it('does not include dropped tool names', async () => {
    const content = await generateInlineContext(root, { mcpConfigured: true })

    expect(content).not.toContain('search_knowledge')
    expect(content).not.toContain('get_module_context')
    expect(content).not.toContain('get_hotspots')
    expect(content).not.toContain('record_decision')
  })
})

describe('detectMcpConfigured', () => {
  it('returns false when no MCP config files exist', async () => {
    expect(await detectMcpConfigured(root)).toBe(false)
  })

  it('returns false when MCP config exists but references no codecortex', async () => {
    await writeFile(
      join(root, '.mcp.json'),
      JSON.stringify({ mcpServers: { other: { command: 'other' } } }),
      'utf-8'
    )
    expect(await detectMcpConfigured(root)).toBe(false)
  })

  it('detects codecortex in .mcp.json (Claude Code project scope)', async () => {
    await writeFile(
      join(root, '.mcp.json'),
      JSON.stringify({ mcpServers: { codecortex: { command: 'codecortex' } } }),
      'utf-8'
    )
    expect(await detectMcpConfigured(root)).toBe(true)
  })

  it('detects codecortex in .cursor/mcp.json', async () => {
    await mkdir(join(root, '.cursor'), { recursive: true })
    await writeFile(
      join(root, '.cursor', 'mcp.json'),
      JSON.stringify({ mcpServers: { codecortex: { command: 'codecortex' } } }),
      'utf-8'
    )
    expect(await detectMcpConfigured(root)).toBe(true)
  })

  it('detects codecortex in .vscode/mcp.json', async () => {
    await mkdir(join(root, '.vscode'), { recursive: true })
    await writeFile(
      join(root, '.vscode', 'mcp.json'),
      JSON.stringify({ servers: { codecortex: { command: 'codecortex' } } }),
      'utf-8'
    )
    expect(await detectMcpConfigured(root)).toBe(true)
  })

  it('detects codecortex in .windsurf/mcp.json', async () => {
    await mkdir(join(root, '.windsurf'), { recursive: true })
    await writeFile(
      join(root, '.windsurf', 'mcp.json'),
      JSON.stringify({ mcpServers: { codecortex: { command: 'codecortex' } } }),
      'utf-8'
    )
    expect(await detectMcpConfigured(root)).toBe(true)
  })
})

describe('injectIntoFile', () => {
  it('creates file if it does not exist', async () => {
    const filePath = join(root, 'NEW.md')
    const content = '<!-- codecortex:start -->\ntest\n<!-- codecortex:end -->\n'

    const result = await injectIntoFile(filePath, content)

    expect(result).toBe(true)
    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe(content)
  })

  it('replaces between markers (idempotent)', async () => {
    const filePath = join(root, 'TEST.md')
    const original = '# Title\n\n<!-- codecortex:start -->\nold content\n<!-- codecortex:end -->\n\n# Footer\n'
    await writeFile(filePath, original, 'utf-8')

    const newContent = '<!-- codecortex:start -->\nnew content\n<!-- codecortex:end -->\n'
    const result = await injectIntoFile(filePath, newContent)

    expect(result).toBe(true)
    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('# Title')
    expect(written).toContain('new content')
    expect(written).not.toContain('old content')
    expect(written).toContain('# Footer')
  })

  it('returns false when content unchanged', async () => {
    const filePath = join(root, 'TEST.md')
    const content = '<!-- codecortex:start -->\ntest\n<!-- codecortex:end -->\n'
    await writeFile(filePath, content, 'utf-8')

    const result = await injectIntoFile(filePath, content.trimEnd())

    expect(result).toBe(false)
  })

  it('migrates from old 3-line pointer', async () => {
    const filePath = join(root, 'CLAUDE.md')
    const old = '# My Project\n\n## CodeCortex\nThis project uses CodeCortex for codebase knowledge. See `.codecortex/AGENT.md` for available MCP tools and when to use them.\n'
    await writeFile(filePath, old, 'utf-8')

    const newContent = '<!-- codecortex:start -->\n## CodeCortex — inline\n<!-- codecortex:end -->\n'
    const result = await injectIntoFile(filePath, newContent)

    expect(result).toBe(true)
    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('# My Project')
    expect(written).toContain('<!-- codecortex:start -->')
    expect(written).not.toContain('.codecortex/AGENT.md')
  })

  it('appends to file without markers', async () => {
    const filePath = join(root, 'CLAUDE.md')
    await writeFile(filePath, '# My Project\n\nSome rules.\n', 'utf-8')

    const newContent = '<!-- codecortex:start -->\ninjected\n<!-- codecortex:end -->\n'
    const result = await injectIntoFile(filePath, newContent)

    expect(result).toBe(true)
    const written = await readFile(filePath, 'utf-8')
    expect(written).toContain('# My Project')
    expect(written).toContain('Some rules.')
    expect(written).toContain('<!-- codecortex:start -->')
  })
})

describe('injectAllAgentFiles', () => {
  it('creates CLAUDE.md when no config files exist', async () => {
    const updated = await injectAllAgentFiles(root)

    expect(updated).toContain('CLAUDE.md')
    const claudeMd = await readFile(join(root, 'CLAUDE.md'), 'utf-8')
    expect(claudeMd).toContain('<!-- codecortex:start -->')
  })

  it('injects into all existing config files', async () => {
    await writeFile(join(root, 'CLAUDE.md'), '# Project\n', 'utf-8')
    await writeFile(join(root, '.cursorrules'), '# Cursor\n', 'utf-8')

    const updated = await injectAllAgentFiles(root)

    expect(updated).toContain('CLAUDE.md')
    expect(updated).toContain('.cursorrules')
  })
})
