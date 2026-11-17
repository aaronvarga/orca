import { z } from 'zod'
const id = z.string().uuid()
export const AzureConnection = z.object({
  connectionId: z.union([id, z.literal('environment')]),
  revision: id,
  requestId: z.string().uuid().optional()
})
export const AzureSelection = AzureConnection.extend({ projectId: id })
export const AzureConnect = z.object({
  baseUrl: z.string().min(1).max(2048),
  label: z.string().max(200),
  token: z.string().min(1).max(4096)
})
export const AzureDisconnect = z.object({ connectionId: z.union([id, z.literal('environment')]) })
export const AzureQueries = AzureSelection.extend({ folderId: id.optional() })
export const AzureQuery = AzureSelection.extend({
  view: z.enum(['assigned', 'all']).optional(),
  search: z.string().max(500).optional(),
  state: z.string().max(200).optional(),
  type: z.string().max(200).optional(),
  queryId: id.optional(),
  teamId: id.optional()
})
export const AzureWorkItem = AzureSelection.extend({ id: z.number().int().positive() })
