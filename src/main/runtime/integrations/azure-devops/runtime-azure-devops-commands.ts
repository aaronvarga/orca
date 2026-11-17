import type { z } from 'zod'
import type * as Params from '../../../../shared/rpc-contract/azure-devops/azure-devops-params'
import * as Boards from '../../../azure-devops/boards-client'

export class RuntimeAzureDevOpsCommands {
  azureDevOpsStatus() {
    return Boards.azureDevOpsStatus()
  }
  azureDevOpsConnect(args: z.infer<typeof Params.AzureConnect>) {
    return Boards.azureDevOpsConnect(args)
  }
  azureDevOpsDisconnect(args: z.infer<typeof Params.AzureDisconnect>) {
    return Boards.azureDevOpsDisconnect(args.connectionId)
  }
  azureDevOpsTestConnection(args: z.infer<typeof Params.AzureConnection>) {
    return Boards.azureDevOpsTestConnection(args)
  }
  azureDevOpsListProjects(args: z.infer<typeof Params.AzureConnection>, signal?: AbortSignal) {
    return Boards.azureDevOpsListProjects(args, signal)
  }
  azureDevOpsListTeams(args: z.infer<typeof Params.AzureSelection>, signal?: AbortSignal) {
    return Boards.azureDevOpsListTeams(args, signal)
  }
  azureDevOpsListQueries(args: z.infer<typeof Params.AzureQueries>, signal?: AbortSignal) {
    return Boards.azureDevOpsListQueries(args, signal)
  }
  azureDevOpsQueryWorkItems(args: z.infer<typeof Params.AzureQuery>, signal?: AbortSignal) {
    return Boards.azureDevOpsQueryWorkItems(args, signal)
  }
  azureDevOpsGetWorkItem(args: z.infer<typeof Params.AzureWorkItem>, signal?: AbortSignal) {
    return Boards.azureDevOpsGetWorkItem(args, signal)
  }
  azureDevOpsMetadata(args: z.infer<typeof Params.AzureSelection>, signal?: AbortSignal) {
    return Boards.azureDevOpsMetadata(args, signal)
  }
}
