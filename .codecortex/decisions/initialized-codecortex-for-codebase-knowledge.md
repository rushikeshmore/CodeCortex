# Decision: Initialized CodeCortex for codebase knowledge

**Date:** 2026-04-21
**Status:** accepted

## Context
AI agents need persistent knowledge to avoid re-learning the codebase each session.

## Decision
Using CodeCortex to pre-analyze symbols, dependencies, coupling, and patterns.

## Alternatives Considered
- Manual CLAUDE.md only
- No codebase context for agents

## Consequences
- AI agents start with knowledge
- .codecortex/ added to repo
- Knowledge needs periodic update via codecortex update
