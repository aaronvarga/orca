import { defineMethod, defineStreamingMethod } from '../../core'
import { emitIntegrationPayload } from './integration-payload'
import {
  AzureConnect,
  AzureDisconnect,
  AzureConnection,
  AzureSelection,
  AzureQueries,
  AzureQuery,
  AzureWorkItem
} from '../../../../../shared/rpc-contract/azure-devops/azure-devops-params'

export const AZURE_DEVOPS_METHODS = [
  defineMethod({
    name: 'azureDevOps.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => runtime.azureDevOpsStatus()
  }),
  defineMethod({
    name: 'azureDevOps.connect',
    permission: 'accounts-admin',
    params: AzureConnect,
    handler: async (params, { runtime }) => runtime.azureDevOpsConnect(params)
  }),
  defineMethod({
    name: 'azureDevOps.disconnect',
    permission: 'accounts-admin',
    params: AzureDisconnect,
    handler: async (params, { runtime }) => runtime.azureDevOpsDisconnect(params)
  }),
  defineMethod({
    name: 'azureDevOps.testConnection',
    permission: 'workspace',
    params: AzureConnection,
    handler: async (params, { runtime }) => runtime.azureDevOpsTestConnection(params)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.listProjects',
    permission: 'workspace',
    params: AzureConnection,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsListProjects(params, signal), emit)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.listTeams',
    permission: 'workspace',
    params: AzureSelection,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsListTeams(params, signal), emit)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.listQueries',
    permission: 'workspace',
    params: AzureQueries,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsListQueries(params, signal), emit)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.queryWorkItems',
    permission: 'workspace',
    params: AzureQuery,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsQueryWorkItems(params, signal), emit)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.getWorkItem',
    permission: 'workspace',
    params: AzureWorkItem,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsGetWorkItem(params, signal), emit)
  }),
  defineStreamingMethod({
    name: 'azureDevOps.metadata',
    permission: 'workspace',
    params: AzureSelection,
    handler: async (params, { runtime, signal }, emit) =>
      emitIntegrationPayload(await runtime.azureDevOpsMetadata(params, signal), emit)
  })
]
