import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { cortexPath } from '../../utils/files.js'
import { injectAllAgentFiles } from '../../core/context-injection.js'

export async function injectCommand(opts: { root: string }): Promise<void> {
  const root = resolve(opts.root)

  if (!existsSync(cortexPath(root, 'cortex.yaml'))) {
    console.error('Error: No CodeCortex knowledge found. Run `codecortex init` first.')
    process.exitCode = 1
    return
  }

  console.log('Regenerating inline context...')
  const updated = await injectAllAgentFiles(root)

  if (updated.length === 0) {
    console.log('  All agent config files are already up to date.')
  } else {
    for (const file of updated) {
      console.log(`  Updated: ${file}`)
    }
  }
  console.log('')
  console.log('Done. Agent config files now contain inline project knowledge.')
}
