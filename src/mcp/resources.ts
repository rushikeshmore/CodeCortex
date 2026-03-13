import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { readFile, cortexPath } from '../utils/files.js'
import { listModuleDocs } from '../core/modules.js'

export function registerResources(server: McpServer, projectRoot: string): void {
  // Resource 1: Project overview (constitution)
  server.registerResource(
    'project_overview',
    'codecortex://project/overview',
    {
      description: 'Project constitution — architecture, risk map, and available knowledge.',
      mimeType: 'text/markdown',
    },
    async () => {
      const content = await readFile(cortexPath(projectRoot, 'constitution.md'))
      return {
        contents: [{
          uri: 'codecortex://project/overview',
          mimeType: 'text/markdown',
          text: content || 'No constitution found. Run `codecortex init` first.',
        }],
      }
    }
  )

  // Resource 2: Hotspots (risk-ranked files)
  server.registerResource(
    'project_hotspots',
    'codecortex://project/hotspots',
    {
      description: 'Risk-ranked files — change frequency, coupling, and bug history.',
      mimeType: 'text/markdown',
    },
    async () => {
      const content = await readFile(cortexPath(projectRoot, 'hotspots.md'))
      return {
        contents: [{
          uri: 'codecortex://project/hotspots',
          mimeType: 'text/markdown',
          text: content || 'No hotspots data. Run `codecortex init` first.',
        }],
      }
    }
  )

  // Resource 3: Module docs (template)
  server.registerResource(
    'module_doc',
    new ResourceTemplate('codecortex://module/{name}', {
      list: async () => {
        const modules = await listModuleDocs(projectRoot)
        return {
          resources: modules.map(name => ({
            uri: `codecortex://module/${name}`,
            name: `Module: ${name}`,
            description: `Documentation for the ${name} module.`,
            mimeType: 'text/markdown',
          })),
        }
      },
    }),
    {
      description: 'Module documentation — purpose, data flow, public API, gotchas.',
      mimeType: 'text/markdown',
    },
    async (uri, { name }) => {
      const content = await readFile(cortexPath(projectRoot, `modules/${name}.md`))
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: content || `No documentation found for module "${name}".`,
        }],
      }
    }
  )
}
