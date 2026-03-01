import simpleGit from 'simple-git'

export interface DiffResult {
  filesChanged: string[]
  insertions: number
  deletions: number
  summary: string
}

export async function getUncommittedDiff(root: string): Promise<DiffResult> {
  const git = simpleGit(root)
  const diff = await git.diffSummary()

  return {
    filesChanged: diff.files.map(f => f.file),
    insertions: diff.insertions,
    deletions: diff.deletions,
    summary: `${diff.files.length} files changed, +${diff.insertions} -${diff.deletions}`,
  }
}

export async function getDiffSinceCommit(root: string, commitHash: string): Promise<DiffResult> {
  const git = simpleGit(root)
  const diff = await git.diffSummary([commitHash, 'HEAD'])

  return {
    filesChanged: diff.files.map(f => f.file),
    insertions: diff.insertions,
    deletions: diff.deletions,
    summary: `${diff.files.length} files changed since ${commitHash.slice(0, 7)}, +${diff.insertions} -${diff.deletions}`,
  }
}

export async function getChangedFilesSinceDate(root: string, sinceDate: string): Promise<string[]> {
  const git = simpleGit(root)
  const log = await git.log({ '--since': sinceDate, '--name-only': null })

  const files = new Set<string>()
  for (const commit of log.all) {
    const diff = commit.diff
    if (diff) {
      for (const file of diff.files) {
        files.add(file.file)
      }
    }
  }

  return [...files]
}

export function mapFilesToModules(files: string[]): Map<string, string[]> {
  const moduleMap = new Map<string, string[]>()

  for (const file of files) {
    const parts = file.split('/')
    let module = 'root'

    if (parts[0] === 'src' && parts.length >= 3 && parts[1]) {
      module = parts[1]
    } else if (parts[0] === 'lib' && parts.length >= 3 && parts[1]) {
      module = parts[1]
    }

    const existing = moduleMap.get(module) || []
    existing.push(file)
    moduleMap.set(module, existing)
  }

  return moduleMap
}
