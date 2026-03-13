import { describe, it, expect } from 'vitest'
import { generateHotspotsMarkdown } from '../../src/git/temporal.js'
import type { TemporalData } from '../../src/types/index.js'

const baseTemporal: TemporalData = {
  generated: '2026-03-11T00:00:00.000Z',
  periodDays: 90,
  totalCommits: 50,
  hotspots: [],
  coupling: [],
  bugHistory: [],
}

describe('generateHotspotsMarkdown', () => {
  it('produces valid markdown with header', () => {
    const md = generateHotspotsMarkdown(baseTemporal)

    expect(md).toContain('# Risk-Ranked Files')
    expect(md).toContain('50 commits analyzed over 90 days')
  })

  it('handles empty hotspots gracefully', () => {
    const md = generateHotspotsMarkdown(baseTemporal)

    expect(md).toContain('No hotspots detected.')
    expect(md).not.toContain('| File |')
  })

  it('generates markdown table from hotspots', () => {
    const temporal: TemporalData = {
      ...baseTemporal,
      hotspots: [
        { file: 'src/main.ts', changes: 10, stability: 'volatile', lastChanged: '2026-03-10', daysSinceChange: 1 },
        { file: 'src/util.ts', changes: 3, stability: 'stable', lastChanged: '2026-02-01', daysSinceChange: 38 },
      ],
    }

    const md = generateHotspotsMarkdown(temporal)

    expect(md).toContain('| File | Changes | Couplings | Bugs | Risk | Stability |')
    expect(md).toContain('`src/main.ts`')
    expect(md).toContain('`src/util.ts`')
    expect(md).toContain('volatile')
    expect(md).toContain('stable')
  })

  it('includes coupling and bug data in risk scores', () => {
    const temporal: TemporalData = {
      ...baseTemporal,
      hotspots: [
        { file: 'src/risky.ts', changes: 5, stability: 'moderate', lastChanged: '2026-03-10', daysSinceChange: 1 },
      ],
      coupling: [
        { fileA: 'src/risky.ts', fileB: 'src/other.ts', cochanges: 4, strength: 0.8, hasImport: false },
      ],
      bugHistory: [
        { file: 'src/risky.ts', fixCommits: 2, lessons: ['fixed crash'] },
      ],
    }

    const md = generateHotspotsMarkdown(temporal)

    // Risk = 5 (churn) + 0.8*2 (coupling) + 2*3 (bugs) = 12.6
    expect(md).toContain('`src/risky.ts`')
    // Coupling count = 1, bugs = 2
    const lines = md.split('\n')
    const riskyLine = lines.find(l => l.includes('src/risky.ts'))
    expect(riskyLine).toContain('| 1 |')  // couplings
    expect(riskyLine).toContain('| 2 |')  // bugs
  })

  it('caps at 30 files', () => {
    const temporal: TemporalData = {
      ...baseTemporal,
      hotspots: Array.from({ length: 50 }, (_, i) => ({
        file: `src/file${i}.ts`,
        changes: 50 - i,
        stability: 'moderate' as const,
        lastChanged: '2026-03-10',
        daysSinceChange: 1,
      })),
    }

    const md = generateHotspotsMarkdown(temporal)
    const tableRows = md.split('\n').filter(l => l.startsWith('| `'))

    expect(tableRows.length).toBe(30)
  })

  it('sorts by risk score descending', () => {
    const temporal: TemporalData = {
      ...baseTemporal,
      hotspots: [
        { file: 'src/low.ts', changes: 1, stability: 'stable', lastChanged: '2026-03-10', daysSinceChange: 1 },
        { file: 'src/high.ts', changes: 20, stability: 'volatile', lastChanged: '2026-03-10', daysSinceChange: 1 },
      ],
    }

    const md = generateHotspotsMarkdown(temporal)
    const lines = md.split('\n').filter(l => l.startsWith('| `'))

    expect(lines[0]).toContain('src/high.ts')
    expect(lines[1]).toContain('src/low.ts')
  })
})
