/**
 * CodeCortex MCP Server
 *
 * Serves codebase knowledge to AI agents via Model Context Protocol.
 * 5 tools + 3 resources + 2 prompts for navigation, risk, and editing safety.
 *
 * Usage:
 *   codecortex serve
 *
 * Config for Claude Code / Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "codecortex": {
 *         "command": "codecortex",
 *         "args": ["serve"],
 *         "cwd": "/path/to/your-project"
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerReadTools } from './tools/read.js'
import { registerResources } from './resources.js'
import { registerPrompts } from './prompts.js'

export function createServer(projectRoot: string): McpServer {
  const server = new McpServer({
    name: 'codecortex',
    version: '0.6.0',
    description: '5 tools for codebase navigation, risk assessment, and editing safety. Architecture, dependencies, coupling, and hidden dependency detection.',
  })

  registerReadTools(server, projectRoot)
  registerResources(server, projectRoot)
  registerPrompts(server, projectRoot)

  return server
}

export async function startServer(projectRoot: string): Promise<void> {
  const server = createServer(projectRoot)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`CodeCortex MCP server running on stdio (root: ${projectRoot})`)
}

// Direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  startServer(root).catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
