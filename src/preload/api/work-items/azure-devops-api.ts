import type { z } from 'zod'
import type * as Params from '../../../shared/rpc-contract/azure-devops/azure-devops-params'
import type {
  AzureDevOpsStatus,
  AzureDevOpsConnection,
  AzureDevOpsProject,
  AzureDevOpsQuery,
  AzureDevOpsWorkItem,
  AzureDevOpsWorkItemResults,
  AzureDevOpsMetadata
} from '../../../shared/azure-devops/boards-types'
export type AzureDevOpsApi = {
  cancelRead: (args: { requestId: string }) => Promise<void>
  status: () => Promise<AzureDevOpsStatus>
  connect: (args: z.infer<typeof Params.AzureConnect>) => Promise<AzureDevOpsConnection>
  disconnect: (args: z.infer<typeof Params.AzureDisconnect>) => Promise<void>
  testConnection: (
    args: z.infer<typeof Params.AzureConnection>
  ) => Promise<AzureDevOpsConnection['viewer']>
  listProjects: (args: z.infer<typeof Params.AzureConnection>) => Promise<AzureDevOpsProject[]>
  listTeams: (args: z.infer<typeof Params.AzureSelection>) => Promise<AzureDevOpsProject[]>
  listQueries: (args: z.infer<typeof Params.AzureQueries>) => Promise<AzureDevOpsQuery[]>
  queryWorkItems: (args: z.infer<typeof Params.AzureQuery>) => Promise<AzureDevOpsWorkItemResults>
  getWorkItem: (args: z.infer<typeof Params.AzureWorkItem>) => Promise<AzureDevOpsWorkItem>
  metadata: (args: z.infer<typeof Params.AzureSelection>) => Promise<AzureDevOpsMetadata>
}
