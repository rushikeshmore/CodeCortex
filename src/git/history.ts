import simpleGit from 'simple-git'

export interface CommitInfo {
  hash: string
  date: string
  message: string
  author: string
  filesChanged: string[]
}

export async function getCommitHistory(root: string, days: number = 90): Promise<CommitInfo[]> {
  const git = simpleGit(root)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const log = await git.log({
    '--since': since,
    '--stat': null,
    maxCount: 500,
  })

  return log.all.map(commit => ({
    hash: commit.hash,
    date: commit.date,
    message: commit.message,
    author: commit.author_name,
    filesChanged: parseStatFiles(commit.diff),
  }))
}

function parseStatFiles(diff: { files?: { file: string }[] } | null | undefined): string[] {
  if (!diff || !diff.files) return []
  return diff.files.map((f) => f.file)
}

export async function getLastCommitDate(root: string, file: string): Promise<string | null> {
  const git = simpleGit(root)
  try {
    const log = await git.log({ file, maxCount: 1 })
    return log.latest?.date || null
  } catch {
    return null
  }
}

export async function isGitRepo(root: string): Promise<boolean> {
  const git = simpleGit(root)
  try {
    await git.status()
    return true
  } catch {
    return false
  }
}

export async function getHeadCommit(root: string): Promise<string | null> {
  const git = simpleGit(root)
  try {
    const log = await git.log({ maxCount: 1 })
    return log.latest?.hash || null
  } catch {
    return null
  }
}
