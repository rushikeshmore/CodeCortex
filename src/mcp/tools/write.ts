import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFile as readFileUtil, cortexPath } from '../../utils/files.js'
import { writeDecision, createDecision } from '../../core/decisions.js'
import { addPattern } from '../../core/patterns.js'
import { writeFile, ensureDir } from '../../utils/files.js'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerWriteTools(server: McpServer, projectRoot: string): void {
  // --- Tool 11: record_decision ---
  server.registerTool(
    'record_decision',
    {
      description: 'Record an architectural decision. Documents WHY something is built a certain way, what alternatives were considered, and consequences. Use whenever a non-obvious technical choice is made.',
      inputSchema: {
        title: z.string().describe('Decision title (e.g., "Use tree-sitter for parsing")'),
        context: z.string().describe('What situation led to this decision'),
        decision: z.string().describe('What was decided'),
        alternatives: z.array(z.string()).default([]).describe('What other options were considered'),
        consequences: z.array(z.string()).default([]).describe('Expected consequences of this decision'),
      },
    },
    async ({ title, context, decision, alternatives, consequences }) => {
      const record = createDecision({ title, context, decision, alternatives, consequences })
      await writeDecision(projectRoot, record)

      return textResult({
        recorded: true,
        id: record.id,
        path: `.codecortex/decisions/${record.id}.md`,
      })
    }
  )

  // --- Tool 12: update_patterns ---
  server.registerTool(
    'update_patterns',
    {
      description: 'Add or update a coding pattern. Patterns document HOW code is written in this project (naming conventions, error handling, testing approaches). Returns "added", "updated", or "noop".',
      inputSchema: {
        name: z.string().describe('Pattern name (e.g., "Error handling in API routes")'),
        description: z.string().describe('What the pattern is and when to use it'),
        example: z.string().describe('Code example showing the pattern'),
        files: z.array(z.string()).default([]).describe('Files where this pattern is used'),
      },
    },
    async ({ name, description, example, files }) => {
      const result = await addPattern(projectRoot, { name, description, example, files })

      return textResult({
        action: result,
        pattern: name,
        path: '.codecortex/patterns.md',
      })
    }
  )

  // --- Tool 13: record_observation ---
  server.registerTool(
    'record_observation',
    {
      description: 'Record something you learned about the codebase. Use this to capture observations, gotchas, undocumented dependencies, environment requirements, or anything future agents should know. Observations persist across sessions.',
      inputSchema: {
        topic: z.string().describe('Short topic label (e.g., "circular dependency in auth", "Docker required for tests")'),
        observation: z.string().describe('What you observed or learned'),
        files: z.array(z.string()).default([]).describe('Related file paths (optional)'),
        reporter: z.string().default('agent').describe('Who is reporting (default: agent)'),
      },
    },
    async ({ topic, observation, files, reporter }) => {
      const dir = cortexPath(projectRoot, 'observations')
      await ensureDir(dir)

      const entry = {
        date: new Date().toISOString(),
        topic,
        observation,
        files,
        reporter,
      }

      // Append to observations log
      const obsPath = cortexPath(projectRoot, 'observations', 'log.json')
      const existing = await readFileUtil(obsPath)
      const entries = existing ? JSON.parse(existing) : []
      entries.push(entry)
      await writeFile(obsPath, JSON.stringify(entries, null, 2))

      return textResult({
        recorded: true,
        totalObservations: entries.length,
        message: 'Observation recorded. Future agents will see this.',
      })
    }
  )
}
