import { execSync } from 'node:child_process'
import { checkForUpdate, getUpgradeCommand } from '../utils/version-check.js'

export async function upgradeCommand(currentVersion: string): Promise<void> {
  console.log('Checking for updates...')
  console.log('')

  const result = await checkForUpdate(currentVersion)

  if (!result) {
    console.log('Could not reach the npm registry. Check your internet connection.')
    return
  }

  if (!result.isOutdated) {
    console.log(`Already on the latest version (${result.current}).`)
    return
  }

  const cmd = getUpgradeCommand()
  console.log(`Update available: ${result.current} → ${result.latest}`)
  console.log('')
  console.log(`Running: ${cmd}`)
  console.log('')

  try {
    execSync(cmd, { stdio: 'inherit' })
    console.log('')
    console.log(`Successfully upgraded to ${result.latest}!`)
  } catch {
    console.error('')
    console.error('Upgrade failed. Try running manually:')
    console.error(`  ${cmd}`)
    console.error('')
    console.error('If you get a permission error, try:')
    console.error(`  sudo ${cmd}`)
  }
}
