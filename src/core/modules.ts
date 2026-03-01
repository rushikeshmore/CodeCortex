import type { ModuleAnalysis } from '../types/index.js'
import { readFile, writeFile, listFiles, cortexPath, ensureDir } from '../utils/files.js'
import { generateModuleDoc } from '../utils/markdown.js'

export async function readModuleDoc(projectRoot: string, moduleName: string): Promise<string | null> {
  return readFile(cortexPath(projectRoot, 'modules', `${moduleName}.md`))
}

export async function writeModuleDoc(projectRoot: string, analysis: ModuleAnalysis): Promise<void> {
  const dir = cortexPath(projectRoot, 'modules')
  await ensureDir(dir)
  const content = generateModuleDoc(analysis)
  await writeFile(cortexPath(projectRoot, 'modules', `${analysis.name}.md`), content)
}

export async function listModuleDocs(projectRoot: string): Promise<string[]> {
  const dir = cortexPath(projectRoot, 'modules')
  const files = await listFiles(dir, '.md')
  return files.map(f => {
    const name = f.split('/').pop() || ''
    return name.replace('.md', '')
  })
}

export function buildAnalysisPrompt(moduleName: string, sourceFiles: { path: string; content: string }[]): string {
  const fileList = sourceFiles.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')

  return `Analyze the "${moduleName}" module. Return a JSON object with this exact structure:

{
  "name": "${moduleName}",
  "purpose": "One paragraph describing what this module does and why it exists",
  "dataFlow": "How data flows through this module — inputs, transformations, outputs",
  "publicApi": ["list", "of", "exported", "functions", "and", "types"],
  "gotchas": ["Things that are surprising or could cause bugs"],
  "dependencies": ["What this module depends on and why"]
}

Source files:

${fileList}`
}
