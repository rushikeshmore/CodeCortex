import type { ModuleAnalysis, DecisionRecord, CodingPattern } from '../types/index.js'

export function generateModuleDoc(analysis: ModuleAnalysis): string {
  const lines: string[] = [
    `# Module: ${analysis.name}`,
    '',
    `## Purpose`,
    analysis.purpose,
    '',
    `## Data Flow`,
    analysis.dataFlow,
    '',
    `## Public API`,
    ...analysis.publicApi.map(api => `- \`${api}\``),
    '',
    `## Dependencies`,
    ...analysis.dependencies.map(dep => `- ${dep}`),
  ]

  if (analysis.gotchas.length > 0) {
    lines.push('', `## Gotchas`, ...analysis.gotchas.map(g => `- ${g}`))
  }

  if (analysis.temporalSignals) {
    const t = analysis.temporalSignals
    lines.push(
      '',
      `## Temporal Signals`,
      `- **Churn:** ${t.churn}`,
      `- **Coupled with:** ${t.coupledWith.join(', ') || 'none'}`,
      `- **Stability:** ${t.stability}`,
    )
    if (t.bugHistory.length > 0) {
      lines.push(`- **Bug history:** ${t.bugHistory.join('; ')}`)
    }
    lines.push(`- **Last changed:** ${t.lastChanged}`)
  }

  return lines.join('\n') + '\n'
}

export function generateDecisionDoc(decision: DecisionRecord): string {
  const lines: string[] = [
    `# Decision: ${decision.title}`,
    '',
    `**Date:** ${decision.date}`,
    `**Status:** ${decision.status}`,
    '',
    `## Context`,
    decision.context,
    '',
    `## Decision`,
    decision.decision,
  ]

  if (decision.alternatives.length > 0) {
    lines.push('', `## Alternatives Considered`, ...decision.alternatives.map(a => `- ${a}`))
  }

  if (decision.consequences.length > 0) {
    lines.push('', `## Consequences`, ...decision.consequences.map(c => `- ${c}`))
  }

  return lines.join('\n') + '\n'
}

export function generatePatternEntry(pattern: CodingPattern): string {
  const lines: string[] = [
    `### ${pattern.name}`,
    '',
    pattern.description,
    '',
    '```',
    pattern.example,
    '```',
  ]

  if (pattern.files.length > 0) {
    lines.push('', `Files: ${pattern.files.map(f => `\`${f}\``).join(', ')}`)
  }

  return lines.join('\n')
}
