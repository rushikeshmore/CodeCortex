#!/usr/bin/env node

import { createRequire } from 'node:module'
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { serveCommand } from './commands/serve.js'
import { updateCommand } from './commands/update.js'
import { statusCommand } from './commands/status.js'
import { symbolsCommand } from './commands/symbols.js'
import { searchCommand } from './commands/search.js'
import { modulesCommand } from './commands/modules.js'
import { hotspotsCommand } from './commands/hotspots.js'
import { hookInstallCommand, hookUninstallCommand, hookStatusCommand } from './commands/hook.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const program = new Command()

program
  .name('codecortex')
  .description('Persistent, AI-powered codebase knowledge layer')
  .version(version)

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

program
  .command('symbols [query]')
  .description('Browse and filter the symbol index')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-k, --kind <kind>', 'Filter by kind: function, class, interface, type, const, enum, method, property, variable')
  .option('-f, --file <path>', 'Filter by file path (partial match)')
  .option('-e, --exported', 'Show only exported symbols')
  .option('-l, --limit <number>', 'Max results', '30')
  .action((query, opts) => symbolsCommand(query, opts))

program
  .command('search <query>')
  .description('Search across all CodeCortex knowledge files')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-l, --limit <number>', 'Max results', '20')
  .action((query, opts) => searchCommand(query, opts))

program
  .command('modules [name]')
  .description('List modules or deep-dive into a specific module')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action((name, opts) => modulesCommand(name, opts))

program
  .command('hotspots')
  .description('Show files ranked by risk: churn + coupling + bug history')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .option('-l, --limit <number>', 'Number of files to show', '15')
  .action(hotspotsCommand)

const hook = program.command('hook').description('Manage git hooks for auto-updating knowledge')
hook.command('install')
  .description('Install post-commit and post-merge hooks')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(hookInstallCommand)
hook.command('uninstall')
  .description('Remove CodeCortex hooks (preserves other hooks)')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(hookUninstallCommand)
hook.command('status')
  .description('Show hook installation state and knowledge freshness')
  .option('-r, --root <path>', 'Project root directory', process.cwd())
  .action(hookStatusCommand)

program.parse()
