import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFile, cortexPath } from '../utils/files.js'
import { getLatestSession, readSession } from '../core/sessions.js'

export function registerPrompts(server: McpServer, projectRoot: string): void {
  // Prompt 1: Start session — constitution + latest session
  server.registerPrompt(
    'start_session',
    {
      description: 'Get project context and latest session summary to start working. Returns constitution and last session log.',
    },
    async () => {
      const constitution = await readFile(cortexPath(projectRoot, 'constitution.md'))
      const latestId = await getLatestSession(projectRoot)
      let sessionContent: string | null = null
      if (latestId) {
        sessionContent = await readSession(projectRoot, latestId)
      }

      const messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> = []

      messages.push({
        role: 'user',
        content: {
          type: 'text',
          text: constitution || 'No project constitution found. Run `codecortex init` first.',
        },
      })

      if (sessionContent) {
        messages.push({
          role: 'user',
          content: {
            type: 'text',
            text: `## Last Session\n\n${sessionContent}`,
          },
        })
      }

      return {
        description: 'Project context and latest session',
        messages,
      }
    }
  )

  // Prompt 2: Before editing — file-specific risk briefing
  server.registerPrompt(
    'before_editing',
    {
      description: 'Get risk assessment and coupling warnings for files you plan to edit. Pass comma-separated file paths.',
      argsSchema: {
        files: z.string().describe('Comma-separated file paths to check (e.g., "src/main.ts,src/utils.ts")'),
      },
    },
    async ({ files }) => {
      const filePaths = files.split(',').map(f => f.trim()).filter(Boolean)

      const temporalContent = await readFile(cortexPath(projectRoot, 'temporal.json'))
      if (!temporalContent) {
        return {
          description: 'Edit briefing',
          messages: [{
            role: 'user' as const,
            content: { type: 'text' as const, text: 'No temporal data. Run `codecortex init` first.' },
          }],
        }
      }

      const temporal = JSON.parse(temporalContent)
      const lines: string[] = [`## Edit Briefing for ${filePaths.length} file(s)\n`]

      for (const file of filePaths) {
        lines.push(`### ${file}\n`)

        // Hotspot info
        const hotspot = temporal.hotspots?.find((h: { file: string }) => h.file.includes(file))
        if (hotspot) {
          lines.push(`- **Changes:** ${hotspot.changes} (${hotspot.stability})`)
          lines.push(`- **Last changed:** ${hotspot.lastChanged}`)
        }

        // Coupling warnings
        const couplings = (temporal.coupling || []).filter((c: { fileA: string; fileB: string }) =>
          c.fileA.includes(file) || c.fileB.includes(file)
        )
        if (couplings.length > 0) {
          lines.push(`- **Coupled files:**`)
          for (const c of couplings) {
            const other = c.fileA.includes(file) ? c.fileB : c.fileA
            lines.push(`  - \`${other}\` — ${c.cochanges} co-changes (${Math.round(c.strength * 100)}%)${c.hasImport ? '' : ' ⚠ HIDDEN DEP'}`)
          }
        }

        // Bug history
        const bugs = temporal.bugHistory?.find((b: { file: string }) => b.file.includes(file))
        if (bugs) {
          lines.push(`- **Bug history:** ${bugs.fixCommits} fix commits`)
          for (const lesson of bugs.lessons) {
            lines.push(`  - ${lesson}`)
          }
        }

        lines.push('')
      }

      return {
        description: `Edit briefing for ${filePaths.join(', ')}`,
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: lines.join('\n') },
        }],
      }
    }
  )
}
