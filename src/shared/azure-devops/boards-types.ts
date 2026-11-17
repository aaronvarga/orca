import type { SecretAtRestProtection } from '../secure-storage/secret-at-rest-protection'

export type AzureDevOpsConnection = {
  id: string
  label: string
  baseUrl: string
  viewer: { id: string; displayName: string }
  revision: string
  externallyManaged?: boolean
}
export type AzureDevOpsStatus = {
  connections: AzureDevOpsConnection[]
  credentialProtection: SecretAtRestProtection | null
  credentialError?: string
}
export type AzureDevOpsProject = { id: string; name: string }
export type AzureDevOpsQuery = { id: string; name: string; isFolder?: boolean; queryType?: string }
export type AzureDevOpsSelection = { connectionId: string; projectId: string; revision: string }
export type AzureDevOpsWorkItem = {
  id: number
  title: string
  project: AzureDevOpsProject
  type: string
  state: string
  assignee: string
  updatedAt: string
  url: string
  tags: string
  area: string
  iteration: string
  description: string
  acceptanceCriteria: string
  related: { id: number; url: string; label: string }[]
}
export type AzureDevOpsWorkItemQuery = AzureDevOpsSelection & {
  view?: 'assigned' | 'all'
  search?: string
  state?: string
  type?: string
  queryId?: string
  teamId?: string
}
export type AzureDevOpsWorkItemResults = {
  items: AzureDevOpsWorkItem[]
  capped: boolean
  omittedIds: number[]
}
export type AzureDevOpsMetadata = { types: string[]; states: string[] }
