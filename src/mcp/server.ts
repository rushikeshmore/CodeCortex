/**
 * CodeCortex MCP Server
 *
 * Serves codebase knowledge to AI agents via Model Context Protocol.
 * 15 tools: 10 read (knowledge retrieval) + 5 write (knowledge creation).
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
    description: 'Persistent codebase knowledge layer. Pre-digested architecture, symbols, coupling, and patterns served to AI agents.',
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
