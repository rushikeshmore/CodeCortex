import type { Command, Help } from 'commander'

const COMMAND_GROUPS: Array<{ title: string; commands: string[] }> = [
  { title: 'Core',    commands: ['init', 'serve', 'update', 'status'] },
  { title: 'Query',   commands: ['symbols', 'search', 'modules', 'hotspots'] },
  { title: 'Utility', commands: ['hook', 'upgrade'] },
]

export function formatHelp(cmd: Command, helper: Help): string {
  // Only apply grouping to the root program — subcommands use default format
  if (cmd.parent) {
    return defaultFormatHelp(cmd, helper)
  }

  const termWidth = helper.padWidth(cmd, helper)
  const helpWidth = helper.helpWidth ?? 80

  const item = (term: string, desc: string) =>
    helper.formatItem(term, termWidth, desc, helper)

  const output: string[] = [
    `${helper.styleTitle('Usage:')} ${helper.styleUsage(helper.commandUsage(cmd))}`,
    '',
  ]

  // Description
  const desc = helper.commandDescription(cmd)
  if (desc) {
    output.push(helper.boxWrap(helper.styleCommandDescription(desc), helpWidth), '')
  }

  // Options
  const opts = helper.visibleOptions(cmd)
  if (opts.length) {
    output.push(helper.styleTitle('Options:'))
    for (const opt of opts) {
      output.push(item(
        helper.styleOptionTerm(helper.optionTerm(opt)),
        helper.styleOptionDescription(helper.optionDescription(opt)),
      ))
    }
    output.push('')
  }

  // Grouped commands
  const allCmds = helper.visibleCommands(cmd)
  const cmdByName = new Map(allCmds.map(c => [c.name(), c]))

  for (const group of COMMAND_GROUPS) {
    const groupCmds = group.commands
      .map(name => cmdByName.get(name))
      .filter((c): c is Command => c !== undefined)
    if (!groupCmds.length) continue

    output.push(helper.styleTitle(`${group.title}:`))
    for (const c of groupCmds) {
      output.push(item(
        helper.styleSubcommandTerm(helper.subcommandTerm(c)),
        helper.styleSubcommandDescription(helper.subcommandDescription(c)),
      ))
    }
    output.push('')
    for (const c of groupCmds) cmdByName.delete(c.name())
  }

  // Remaining (built-in help command)
  if (cmdByName.size) {
    for (const c of cmdByName.values()) {
      output.push(item(
        helper.styleSubcommandTerm(helper.subcommandTerm(c)),
        helper.styleSubcommandDescription(helper.subcommandDescription(c)),
      ))
    }
    output.push('')
  }

  return output.join('\n')
}

/** Default Commander formatHelp — used for subcommands */
function defaultFormatHelp(cmd: Command, helper: Help): string {
  const termWidth = helper.padWidth(cmd, helper)
  const helpWidth = helper.helpWidth ?? 80

  const item = (term: string, desc: string) =>
    helper.formatItem(term, termWidth, desc, helper)

  const output: string[] = [
    `${helper.styleTitle('Usage:')} ${helper.styleUsage(helper.commandUsage(cmd))}`,
    '',
  ]

  const desc = helper.commandDescription(cmd)
  if (desc) {
    output.push(helper.boxWrap(helper.styleCommandDescription(desc), helpWidth), '')
  }

  const opts = helper.visibleOptions(cmd)
  if (opts.length) {
    output.push(helper.styleTitle('Options:'))
    for (const opt of opts) {
      output.push(item(
        helper.styleOptionTerm(helper.optionTerm(opt)),
        helper.styleOptionDescription(helper.optionDescription(opt)),
      ))
    }
    output.push('')
  }

  const cmds = helper.visibleCommands(cmd)
  if (cmds.length) {
    output.push(helper.styleTitle('Commands:'))
    for (const c of cmds) {
      output.push(item(
        helper.styleSubcommandTerm(helper.subcommandTerm(c)),
        helper.styleSubcommandDescription(helper.subcommandDescription(c)),
      ))
    }
    output.push('')
  }

  return output.join('\n')
}
