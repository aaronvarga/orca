import type { AzureDevOpsApi } from '../../../../preload/api/work-items/azure-devops-api'
import { readRuntimeIntegrationPayload } from '../../runtime/jira/runtime-jira-payload-stream'
import { callRuntimeRpc } from '../../runtime/rpc/calls/runtime-rpc-call'
import { assertRuntimeEnvironmentCapability } from '../../runtime/rpc/compatibility/runtime-capability-proof'
import { AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY } from '../../../../shared/work-items/task-source-runtime-capabilities'
import { translate } from '@/i18n/i18n'
import { requireActiveEnvironment } from '../runtime/client/web-runtime-session'
async function call<T>(method: string, args?: unknown, stream = false): Promise<T> {
  const target = { kind: 'environment', environmentId: requireActiveEnvironment().id } as const
  await assertRuntimeEnvironmentCapability(
    target.environmentId,
    AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY,
    translate(
      'azure.tasks.upgrade',
      'Update Orca on this host to use Azure Boards. Your draft is retained.'
    )
  )
  return stream
    ? readRuntimeIntegrationPayload<T>(target, `azureDevOps.${method}`, args)
    : callRuntimeRpc<T>(target, `azureDevOps.${method}`, args, { timeoutMs: 60_000 })
}
export function createWebAzureDevOpsApi(): AzureDevOpsApi {
  return {
    cancelRead: async () => {},
    status: () => call('status'),
    connect: (args) => call('connect', args),
    disconnect: (args) => call('disconnect', args),
    testConnection: (args) => call('testConnection', args),
    listProjects: (args) => call('listProjects', args, true),
    listTeams: (args) => call('listTeams', args, true),
    listQueries: (args) => call('listQueries', args, true),
    queryWorkItems: (args) => call('queryWorkItems', args, true),
    getWorkItem: (args) => call('getWorkItem', args, true),
    metadata: (args) => call('metadata', args, true)
  }
}
