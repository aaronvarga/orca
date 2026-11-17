import { ipcRenderer } from 'electron'
import type { AzureDevOpsApi } from './azure-devops-api'
export const azureDevOpsApi: AzureDevOpsApi = {
  cancelRead: (args) => ipcRenderer.invoke('azureDevOps:cancelRead', args),
  status: () => ipcRenderer.invoke('azureDevOps:status'),
  connect: (args) => ipcRenderer.invoke('azureDevOps:connect', args),
  disconnect: (args) => ipcRenderer.invoke('azureDevOps:disconnect', args),
  testConnection: (args) => ipcRenderer.invoke('azureDevOps:testConnection', args),
  listProjects: (args) => ipcRenderer.invoke('azureDevOps:listProjects', args),
  listTeams: (args) => ipcRenderer.invoke('azureDevOps:listTeams', args),
  listQueries: (args) => ipcRenderer.invoke('azureDevOps:listQueries', args),
  queryWorkItems: (args) => ipcRenderer.invoke('azureDevOps:queryWorkItems', args),
  getWorkItem: (args) => ipcRenderer.invoke('azureDevOps:getWorkItem', args),
  metadata: (args) => ipcRenderer.invoke('azureDevOps:metadata', args)
}
