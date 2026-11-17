import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { ipcOrRuntimeTargetForHostId } from '../rpc/targets/runtime-client-target'
import { WORKTREE_LINKED_WORK_ITEM_CONTEXT_RUNTIME_CAPABILITY } from '../../../../shared/remote-runtime/protocol/worktree-runtime-capabilities'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { TaskSourceContext } from '../../../../shared/work-items/task-source-context'
import type { WorkspaceLinkedItem, WorkspaceAttachment } from '../../../../shared/worktree/types'
import { AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY } from '../../../../shared/work-items/task-source-runtime-capabilities'
import { assertRuntimeEnvironmentCapability } from '../rpc/compatibility/runtime-capability-proof'
import { translate } from '@/i18n/i18n'

export async function assertLinkedWorkItemCapability(
  target: RuntimeClientTarget | ExecutionHostId,
  input: {
    linkedWorkItem?: Partial<Pick<WorkspaceLinkedItem, 'provider'>> | null
    linkedTask?: Partial<Pick<WorkspaceLinkedItem, 'provider'>> | null
    linkedTaskSourceContext?: TaskSourceContext | null
    linkedItems?: WorkspaceAttachment[]
  }
): Promise<void> {
  const resolved = typeof target === 'string' ? ipcOrRuntimeTargetForHostId(target) : target
  if (!resolved) {
    throw new Error('The selected destination host is unavailable.')
  }
  target = resolved
  const azure =
    input.linkedWorkItem?.provider === 'azure-devops' ||
    input.linkedTask?.provider === 'azure-devops' ||
    input.linkedTaskSourceContext?.provider === 'azure-devops' ||
    input.linkedItems?.some((item) => item.provider === 'azure-devops' && item.type === 'issue')
  const jira =
    input.linkedWorkItem?.provider === 'jira' ||
    input.linkedTask?.provider === 'jira' ||
    input.linkedTaskSourceContext?.provider === 'jira'
  if (jira && target.kind === 'environment') {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      WORKTREE_LINKED_WORK_ITEM_CONTEXT_RUNTIME_CAPABILITY,
      'Update the remote runtime to link Jira'
    )
  }
  if (azure && target.kind === 'environment') {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      AZURE_DEVOPS_TASKS_RUNTIME_CAPABILITY,
      translate(
        'azure.tasks.destinationUpgrade',
        'Update Orca on the destination host to link Azure Boards work items. Your draft is retained.'
      )
    )
  }
}
