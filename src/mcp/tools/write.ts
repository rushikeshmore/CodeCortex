import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFile as readFileUtil, cortexPath } from '../../utils/files.js'
import { ModuleAnalysisSchema, DecisionInputSchema, PatternInputSchema, FeedbackInputSchema } from '../../types/schema.js'
import { writeModuleDoc, buildAnalysisPrompt, listModuleDocs } from '../../core/modules.js'
import { writeDecision, createDecision } from '../../core/decisions.js'
import { addPattern } from '../../core/patterns.js'
import { writeFile, ensureDir } from '../../utils/files.js'
import { readGraph } from '../../core/graph.js'
import type { ModuleAnalysis } from '../../types/index.js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function registerWriteTools(server: McpServer, projectRoot: string) {
  // --- Tool 10: analyze_module ---
  server.registerTool(
    'analyze_module',
    {
      description: 'Prepares a module for analysis. Returns the source files and a structured prompt. You should read the source files, analyze them, then call save_module_analysis with the result.',
      inputSchema: {
        name: z.string().describe('Module name (e.g., "scoring", "api")'),
      },
    },
    async ({ name }) => {
      const graph = await readGraph(projectRoot)
      if (!graph) {
        return textResult({ error: 'No graph data. Run codecortex init first.' })
      }

      const module = graph.modules.find(m => m.name === name)
      if (!module) {
        const available = graph.modules.map(m => m.name)
        return textResult({ error: `Module "${name}" not found`, available })
      }

      // Read source files for this module
      const sourceFiles: { path: string; content: string }[] = []
      for (const filePath of module.files) {
        try {
          const content = await readFile(join(projectRoot, filePath), 'utf-8')
          sourceFiles.push({ path: filePath, content })
        } catch {
          // Skip files that can't be read
        }
      }

      const prompt = buildAnalysisPrompt(name, sourceFiles)

      return textResult({
        module: name,
        files: module.files,
        prompt,
        instruction: 'Analyze the source files above and call save_module_analysis with the JSON result.',
      })
    }
  )

  // --- Tool 11: save_module_analysis ---
  server.registerTool(
    'save_module_analysis',
    {
      description: 'Save the result of a module analysis. Provide the structured analysis (purpose, dataFlow, publicApi, gotchas, dependencies) and it will be persisted to modules/*.md.',
      inputSchema: {
        analysis: ModuleAnalysisSchema.describe('The structured module analysis'),
      },
    },
    async ({ analysis }) => {
      const moduleAnalysis: ModuleAnalysis = {
        ...analysis,
      }

      // Enrich with temporal data if available
      const temporalContent = await readFileUtil(cortexPath(projectRoot, 'temporal.json'))
      if (temporalContent) {
        const temporal = JSON.parse(temporalContent)
        const hotspot = temporal.hotspots?.find((h: any) =>
          h.file.includes(`/${analysis.name}/`) || h.file.includes(`${analysis.name}.`)
        )
        const couplings = temporal.coupling?.filter((c: any) =>
          c.fileA.includes(`/${analysis.name}/`) || c.fileB.includes(`/${analysis.name}/`)
        ) || []
        const bugs = temporal.bugHistory?.filter((b: any) =>
          b.file.includes(`/${analysis.name}/`)
        ) || []

        if (hotspot || couplings.length > 0 || bugs.length > 0) {
          moduleAnalysis.temporalSignals = {
            churn: hotspot ? `${hotspot.changes} changes (${hotspot.stability})` : 'unknown',
            coupledWith: couplings.map((c: any) => {
              const other = c.fileA.includes(`/${analysis.name}/`) ? c.fileB : c.fileA
              return `${other} (${c.cochanges} co-changes)`
            }),
            stability: hotspot?.stability || 'unknown',
            bugHistory: bugs.flatMap((b: any) => b.lessons),
            lastChanged: hotspot?.lastChanged || 'unknown',
          }
        }
      }

      await writeModuleDoc(projectRoot, moduleAnalysis)

      return textResult({
        saved: true,
        module: analysis.name,
        path: `.codecortex/modules/${analysis.name}.md`,
      })
    }
  )

  // --- Tool 12: record_decision ---
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

  // --- Tool 13: update_patterns ---
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

  // --- Tool 14: report_feedback ---
  server.registerTool(
    'report_feedback',
    {
      description: 'Report incorrect or outdated knowledge. If you discover that a module doc, decision, or pattern is wrong, report it here. The feedback will be stored and used in the next analysis cycle.',
      inputSchema: {
        file: z.string().describe('Which knowledge file is incorrect (e.g., "modules/scoring.md")'),
        issue: z.string().describe('What is wrong or outdated'),
        reporter: z.string().default('agent').describe('Who is reporting (default: agent)'),
      },
    },
    async ({ file, issue, reporter }) => {
      const dir = cortexPath(projectRoot, 'feedback')
      await ensureDir(dir)

      const entry = {
        date: new Date().toISOString(),
        file,
        issue,
        reporter,
      }

      // Append to feedback log
      const feedbackPath = cortexPath(projectRoot, 'feedback', 'log.json')
      const existing = await readFileUtil(feedbackPath)
      const entries = existing ? JSON.parse(existing) : []
      entries.push(entry)
      await writeFile(feedbackPath, JSON.stringify(entries, null, 2))

      return textResult({
        recorded: true,
        totalFeedback: entries.length,
        message: 'Feedback recorded. Will be addressed in next codecortex update.',
      })
    }
  )
}
