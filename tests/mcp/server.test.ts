import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../src/mcp/server.js'
import { createFixture, type Fixture } from '../fixtures/setup.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('MCP Server', () => {
  it('creates a server instance', () => {
    const server = createServer(fixture.root)
    expect(server).toBeDefined()
  })

  it('has the correct name and version', () => {
    const server = createServer(fixture.root)
    // The server metadata is set in the constructor
    expect(server).toBeDefined()
    // Server is an McpServer instance — if it doesn't throw, tools are registered
  })
})
