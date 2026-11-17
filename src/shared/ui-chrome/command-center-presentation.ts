import { z } from 'zod'

export const CommandCenterPresentationSchema = z.object({
  layout: z.enum(['auto-grid', 'auto-columns', 'manual']).default('auto-grid'),
  columns: z.number().int().min(1).max(10).default(2),
  rows: z.number().int().min(1).max(8).default(2),
  groupByProject: z.boolean().default(true),
  project: z.string().default('all'),
  host: z.string().default('all'),
  order: z.array(z.string()).max(10000).default([]),
  hidden: z.array(z.string()).max(10000).default([])
})

export type CommandCenterPresentation = z.infer<typeof CommandCenterPresentationSchema>

export function commandCenterPresentation(value: unknown): CommandCenterPresentation {
  const parsed = CommandCenterPresentationSchema.safeParse(value)
  return parsed.success ? parsed.data : CommandCenterPresentationSchema.parse({})
}
