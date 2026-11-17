import { z } from 'zod'
export const selectionSchema = z.object({
  detailId: z.number().int().positive().nullable().default(null),
  connectionId: z.string(),
  projectId: z.string(),
  view: z.enum(['assigned', 'all', 'query']),
  search: z.string(),
  state: z.string(),
  type: z.string(),
  queryId: z.string(),
  queryName: z.string().default(''),
  folderId: z.string().default(''),
  teamId: z.string()
})
export const emptySelection = {
  detailId: null,
  connectionId: '',
  projectId: '',
  view: 'assigned' as const,
  search: '',
  state: '',
  type: '',
  queryId: '',
  queryName: '',
  folderId: '',
  teamId: ''
}
export type AzureTaskSelection = z.infer<typeof selectionSchema>
