import type { SessionLog } from '../types/index.js'
import { readFile, writeFile, listFiles, cortexPath, ensureDir } from '../utils/files.js'

export async function writeSession(projectRoot: string, session: SessionLog): Promise<void> {
  const dir = cortexPath(projectRoot, 'sessions')
  await ensureDir(dir)

  const lines = [
    `# Session: ${session.date}`,
    '',
    `**ID:** ${session.id}`,
    session.previousSession ? `**Previous:** ${session.previousSession}` : null,
    '',
    `## Summary`,
    session.summary,
    '',
    `## Files Changed`,
    ...session.filesChanged.map(f => `- \`${f}\``),
    '',
    `## Modules Affected`,
    ...session.modulesAffected.map(m => `- ${m}`),
  ].filter(Boolean) as string[]

  if (session.decisionsRecorded.length > 0) {
    lines.push('', `## Decisions Recorded`, ...session.decisionsRecorded.map(d => `- ${d}`))
  }

  await writeFile(cortexPath(projectRoot, 'sessions', `${session.id}.md`), lines.join('\n') + '\n')
}

export async function readSession(projectRoot: string, id: string): Promise<string | null> {
  return readFile(cortexPath(projectRoot, 'sessions', `${id}.md`))
}

export async function listSessions(projectRoot: string): Promise<string[]> {
  const dir = cortexPath(projectRoot, 'sessions')
  const files = await listFiles(dir, '.md')
  return files
    .map(f => (f.split('/').pop() || '').replace('.md', ''))
    .sort()
    .reverse()
}

export async function getLatestSession(projectRoot: string): Promise<string | null> {
  const sessions = await listSessions(projectRoot)
  return sessions.length > 0 ? sessions[0] : null
}

export function createSession(opts: {
  filesChanged: string[]
  modulesAffected: string[]
  decisionsRecorded?: string[]
  summary: string
  previousSession?: string
}): SessionLog {
  const now = new Date()
  const id = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return {
    id,
    date: now.toISOString(),
    previousSession: opts.previousSession,
    filesChanged: opts.filesChanged,
    modulesAffected: opts.modulesAffected,
    decisionsRecorded: opts.decisionsRecorded || [],
    summary: opts.summary,
  }
}
