import { parseExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import type { AzureDevOpsApi } from '../../../../preload/api/work-items/azure-devops-api'
import { AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY } from '../../../../shared/work-items/task-source-runtime-capabilities'
import { rowLessSourceTarget, type RowLessSource } from '../hosts/selection/default-creation-host'
import { assertRuntimeEnvironmentCapability } from '../rpc/compatibility/runtime-capability-proof'
import { callRuntimeRpc } from '../rpc/calls/runtime-rpc-call'
import { readRuntimeIntegrationPayload } from '../jira/runtime-jira-payload-stream'
import { translate } from '@/i18n/i18n'

export function azureDevOpsApiForSource(
  source: RowLessSource,
  signal?: AbortSignal
): AzureDevOpsApi {
  const target = rowLessSourceTarget(source)
  async function call<T>(
    method: string,
    args: unknown,
    local: (requestId?: string) => Promise<T>,
    stream = false
  ): Promise<T> {
    if (source.kind === 'task-source' && parseExecutionHostId(source.hostId)?.kind === 'ssh') {
      throw new Error(
        'Select the desktop or paired runtime that owns this Azure Boards connection.'
      )
    }
    signal?.throwIfAborted()
    if (target.kind === 'local') {
      const requestId = signal ? createNonSecureContextUuid() : undefined
      const cancel = (): void => {
        if (requestId) {
          void window.api.azureDevOps.cancelRead({ requestId }).catch(() => undefined)
        }
      }
      signal?.addEventListener('abort', cancel, { once: true })
      try {
        const result = await local(requestId)
        signal?.throwIfAborted()
        return result
      } finally {
        signal?.removeEventListener('abort', cancel)
      }
    }
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY,
      translate(
        'azure.tasks.upgrade',
        'Update Orca on this host to use Azure Boards. Your draft is retained.'
      )
    )
    signal?.throwIfAborted()
    return stream
      ? readRuntimeIntegrationPayload<T>(target, `azureDevOps.${method}`, args, signal)
      : callRuntimeRpc<T>(target, `azureDevOps.${method}`, args, { timeoutMs: 60_000, signal })
  }
  return {
    cancelRead: (args) => window.api.azureDevOps.cancelRead(args),
    status: () => call('status', undefined, () => window.api.azureDevOps.status()),
    connect: (args) => call('connect', args, () => window.api.azureDevOps.connect(args)),
    disconnect: (args) => call('disconnect', args, () => window.api.azureDevOps.disconnect(args)),
    testConnection: (args) =>
      call('testConnection', args, () => window.api.azureDevOps.testConnection(args)),
    listProjects: (args) =>
      call(
        'listProjects',
        args,
        (requestId) => window.api.azureDevOps.listProjects({ ...args, requestId }),
        true
      ),
    listTeams: (args) =>
      call(
        'listTeams',
        args,
        (requestId) => window.api.azureDevOps.listTeams({ ...args, requestId }),
        true
      ),
    listQueries: (args) =>
      call(
        'listQueries',
        args,
        (requestId) => window.api.azureDevOps.listQueries({ ...args, requestId }),
        true
      ),
    queryWorkItems: (args) =>
      call(
        'queryWorkItems',
        args,
        (requestId) => window.api.azureDevOps.queryWorkItems({ ...args, requestId }),
        true
      ),
    getWorkItem: (args) =>
      call(
        'getWorkItem',
        args,
        (requestId) => window.api.azureDevOps.getWorkItem({ ...args, requestId }),
        true
      ),
    metadata: (args) =>
      call(
        'metadata',
        args,
        (requestId) => window.api.azureDevOps.metadata({ ...args, requestId }),
        true
      )
  }
}
