# codecortex-ai — Overview

**Type:** node
**Languages:** typescript
**Files:** 55

## Entry Points
- `dist/cli/index.js`

## Modules
- **cli**
- **core**
- **extraction**
- **git**
- **mcp**
- **types**
- **utils**

## File Map

### ./
- tsup.config.ts
- vitest.config.ts

### src/cli/
- grouped-help.ts
- index.ts

### src/cli/commands/
- hook.ts
- hotspots.ts
- init.ts
- modules.ts
- search.ts
- serve.ts
- status.ts
- symbols.ts
- update.ts
- upgrade.ts

### src/cli/utils/
- version-check.ts

### src/core/
- constitution.ts
- decisions.ts
- discovery.ts
- graph.ts
- manifest.ts
- module-gen.ts
- modules.ts
- patterns.ts
- search.ts
- sessions.ts

### src/extraction/
- calls.ts
- imports.ts
- parser.ts
- symbols.ts

### src/git/
- diff.ts
- history.ts
- temporal.ts

### src/mcp/
- server.ts

### src/mcp/tools/
- read.ts
- write.ts

### src/types/
- index.ts
- schema.ts

### src/utils/
- files.ts
- markdown.ts
- yaml.ts

### tests/cli/
- hook.test.ts
- version-check.test.ts

### tests/core/
- decisions.test.ts
- graph.test.ts
- search.test.ts
- sessions.test.ts

### tests/extraction/
- calls.test.ts
- imports.test.ts
- parser.test.ts
- symbols.test.ts

### tests/fixtures/
- setup.ts

### tests/mcp/
- read-tools.test.ts
- server.test.ts
- simulation.test.ts
- write-tools.test.ts
