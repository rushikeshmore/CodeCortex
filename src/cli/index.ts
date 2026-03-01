#!/usr/bin/env node

import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { serveCommand } from './commands/serve.js'
import { updateCommand } from './commands/update.js'
import { statusCommand } from './commands/status.js'

const program = new Command()

program
  .name('codecortex')
  .description('Persistent, AI-powered codebase knowledge layer')
  .version('0.1.0')

program
  .command('init')
  .description('Initialize codebase knowledge: discover files, extract symbols, analyze git history')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-d, --days <number>', 'Days of git history to analyze', '90')
  .action(initCommand)

program
  .command('serve')
  .description('Start MCP server (stdio transport) for AI agent access')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(serveCommand)

program
  .command('update')
  .description('Update knowledge for changed files since last session')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-d, --days <number>', 'Days of git history to re-analyze', '90')
  .action(updateCommand)

program
  .command('status')
  .description('Show knowledge freshness, stale modules, and symbol counts')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(statusCommand)

program.parse()
