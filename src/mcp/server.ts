/**
 * CodeCortex MCP Server
 *
 * Serves codebase knowledge to AI agents via Model Context Protocol.
 * 13 tools: 8 read + 5 write (navigation, risk, memory).
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
import { registerWriteTools } from './tools/write.js'

export function createServer(projectRoot: string): McpServer {
  const server = new McpServer({
    name: 'codecortex',
    version: '0.5.0',
    description: 'Persistent codebase knowledge layer for AI agents. Architecture, dependencies, coupling, risk, and cross-session memory.',
  })

  registerReadTools(server, projectRoot)
  registerWriteTools(server, projectRoot)

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
