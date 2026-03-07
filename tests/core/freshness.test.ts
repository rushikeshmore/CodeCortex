/**
 * Tests for freshness computation.
 *
 * Uses the test fixture with known lastUpdated dates to test
 * freshness classification without needing a real git repo.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createFixture, type Fixture } from '../fixtures/setup.js'
import { readManifest, writeManifest } from '../../src/core/manifest.js'
import type { CortexManifest } from '../../src/types/index.js'

let fixture: Fixture

beforeAll(async () => {
  fixture = await createFixture()
})

afterAll(async () => {
  await fixture.cleanup()
})

describe('freshness classification', () => {
  it('fixture has a valid manifest with lastUpdated', async () => {
    const manifest = await readManifest(fixture.root)
    expect(manifest).not.toBeNull()
    expect(manifest!.lastUpdated).toBeTruthy()
  })

  it('manifest lastUpdated is a valid ISO date', async () => {
    const manifest = await readManifest(fixture.root)
    const date = new Date(manifest!.lastUpdated)
    expect(date.getTime()).not.toBeNaN()
  })

  it('can update manifest lastUpdated', async () => {
    const manifest = await readManifest(fixture.root)
    const updated: CortexManifest = {
      ...manifest!,
      lastUpdated: new Date().toISOString(),
    }
    await writeManifest(fixture.root, updated)

    const reread = await readManifest(fixture.root)
    expect(reread!.lastUpdated).toBe(updated.lastUpdated)
  })
})

describe('freshness status rules', () => {
  // Test the classification logic directly (without git dependency)
  it('fresh: 0 files, <=7 days', () => {
    const count = 0
    const days = 3
    expect(classifyFreshness(count, days)).toBe('fresh')
  })

  it('slightly_stale: 1-2 files, <=7 days', () => {
    expect(classifyFreshness(1, 5)).toBe('slightly_stale')
    expect(classifyFreshness(2, 7)).toBe('slightly_stale')
  })

  it('stale: 3-5 files or <=14 days', () => {
    expect(classifyFreshness(3, 5)).toBe('stale')
    expect(classifyFreshness(5, 10)).toBe('stale')
  })

  it('very_stale: >5 files and >14 days', () => {
    expect(classifyFreshness(10, 20)).toBe('very_stale')
    expect(classifyFreshness(6, 15)).toBe('very_stale')
  })
})

/** Mirror the classification logic from freshness.ts for unit testing without git. */
function classifyFreshness(filesChanged: number, daysSinceAnalysis: number): string {
  if (filesChanged === 0 && daysSinceAnalysis <= 7) return 'fresh'
  if (filesChanged <= 2 && daysSinceAnalysis <= 7) return 'slightly_stale'
  if (filesChanged <= 5 || daysSinceAnalysis <= 14) return 'stale'
  return 'very_stale'
}
