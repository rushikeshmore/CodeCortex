import type { DecisionRecord } from '../types/index.js'
import { readFile, writeFile, listFiles, cortexPath, ensureDir } from '../utils/files.js'
import { generateDecisionDoc } from '../utils/markdown.js'

export async function readDecision(projectRoot: string, id: string): Promise<string | null> {
  return readFile(cortexPath(projectRoot, 'decisions', `${id}.md`))
}

export async function writeDecision(projectRoot: string, decision: DecisionRecord): Promise<void> {
  const dir = cortexPath(projectRoot, 'decisions')
  await ensureDir(dir)
  const content = generateDecisionDoc(decision)
  await writeFile(cortexPath(projectRoot, 'decisions', `${decision.id}.md`), content)
}

export async function listDecisions(projectRoot: string): Promise<string[]> {
  const dir = cortexPath(projectRoot, 'decisions')
  const files = await listFiles(dir, '.md')
  return files.map(f => {
    const name = f.split('/').pop() || ''
    return name.replace('.md', '')
  })
}

export function createDecision(input: {
  title: string
  context: string
  decision: string
  alternatives?: string[]
  consequences?: string[]
}): DecisionRecord {
  const id = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  return {
    id,
    date: new Date().toISOString().split('T')[0] ?? '',
    title: input.title,
    context: input.context,
    decision: input.decision,
    alternatives: input.alternatives || [],
    consequences: input.consequences || [],
    status: 'accepted',
  }
}
