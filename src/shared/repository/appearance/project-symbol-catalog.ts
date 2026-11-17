import { z } from 'zod'

export const ProjectSymbolCatalogSchema = z.object({
  entries: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        search: z.string().max(4096),
        categories: z.array(z.string().max(100)).max(64)
      })
    )
    .max(20000),
  categories: z
    .array(
      z.object({
        key: z.string().max(100),
        name: z.string().max(100),
        icon: z.string().max(128).optional()
      })
    )
    .max(100)
})
export type ProjectSymbolCatalog = z.infer<typeof ProjectSymbolCatalogSchema>
