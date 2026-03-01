import { z } from 'zod'

export const ModuleAnalysisSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  dataFlow: z.string(),
  publicApi: z.array(z.string()),
  gotchas: z.array(z.string()),
  dependencies: z.array(z.string()),
})

export const DecisionInputSchema = z.object({
  title: z.string(),
  context: z.string(),
  decision: z.string(),
  alternatives: z.array(z.string()).default([]),
  consequences: z.array(z.string()).default([]),
})

export const PatternInputSchema = z.object({
  name: z.string(),
  description: z.string(),
  example: z.string(),
  files: z.array(z.string()).default([]),
})

export const FeedbackInputSchema = z.object({
  file: z.string(),
  issue: z.string(),
  reporter: z.string().default('agent'),
})
