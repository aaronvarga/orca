import { z } from 'zod'
import type { WebContents } from 'electron'
import { JiraCancellableRequests } from '../jira/cancellable-requests'
import { ipcMain } from 'electron'
import * as Params from '../../../shared/rpc-contract/azure-devops/azure-devops-params'
import * as Boards from '../../azure-devops/boards-client'

const readOwners = new WeakMap<WebContents, JiraCancellableRequests>()
function readsFor(sender: WebContents): JiraCancellableRequests {
  let owner = readOwners.get(sender)
  if (!owner) {
    owner = new JiraCancellableRequests()
    readOwners.set(sender, owner)
  }
  return owner
}
export function registerAzureDevOpsHandlers(): void {
  ipcMain.handle('azureDevOps:cancelRead', (event, input: unknown) =>
    readsFor(event.sender).cancel(z.object({ requestId: z.string().uuid() }).parse(input).requestId)
  )
  ipcMain.handle('azureDevOps:status', async () => Boards.azureDevOpsStatus())
  ipcMain.handle('azureDevOps:connect', async (_event, input: unknown) =>
    Boards.azureDevOpsConnect(Params.AzureConnect.parse(input))
  )
  ipcMain.handle('azureDevOps:disconnect', async (_event, input: unknown) => {
    const args = Params.AzureDisconnect.parse(input)
    return Boards.azureDevOpsDisconnect(args.connectionId)
  })
  ipcMain.handle('azureDevOps:testConnection', async (_event, input: unknown) =>
    Boards.azureDevOpsTestConnection(Params.AzureConnection.parse(input))
  )
  ipcMain.handle('azureDevOps:listProjects', async (event, input: unknown) => {
    const args = Params.AzureConnection.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsListProjects(args, signal)
    )
  })
  ipcMain.handle('azureDevOps:listTeams', async (event, input: unknown) => {
    const args = Params.AzureSelection.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsListTeams(args, signal)
    )
  })
  ipcMain.handle('azureDevOps:listQueries', async (event, input: unknown) => {
    const args = Params.AzureQueries.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsListQueries(args, signal)
    )
  })
  ipcMain.handle('azureDevOps:queryWorkItems', async (event, input: unknown) => {
    const args = Params.AzureQuery.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsQueryWorkItems(args, signal)
    )
  })
  ipcMain.handle('azureDevOps:getWorkItem', async (event, input: unknown) => {
    const args = Params.AzureWorkItem.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsGetWorkItem(args, signal)
    )
  })
  ipcMain.handle('azureDevOps:metadata', async (event, input: unknown) => {
    const args = Params.AzureSelection.parse(input)
    return readsFor(event.sender).run(args.requestId, (signal) =>
      Boards.azureDevOpsMetadata(args, signal)
    )
  })
}
