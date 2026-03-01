import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath } from '../../utils/files.js'
import { startServer } from '../../mcp/server.js'

export async function serveCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  // Check if .codecortex/ exists
  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.error('Error: No CodeCortex knowledge found.')
    console.error(`Run 'codecortex init' first to analyze the codebase.`)
    console.error(`Expected: ${cortexPath(root, 'cortex.yaml')}`)
    process.exit(1)
  }

  await startServer(root)
}
