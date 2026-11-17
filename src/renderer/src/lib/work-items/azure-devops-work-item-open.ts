import type { WorkspaceAttachment } from '../../../../shared/worktree/types'
import { isWorkspaceLinkedItemSourceContextMatch } from '../../../../shared/workspace-attachments/workspace-linked-item-source-context'
import { useAppStore } from '@/store'
export function openAzureDevOpsWorkItemInOrca(item: WorkspaceAttachment): boolean {
  if (
    item.provider !== 'azure-devops' ||
    item.type !== 'issue' ||
    !item.url ||
    !item.taskSourceContext ||
    !isWorkspaceLinkedItemSourceContextMatch(
      { ...item, provider: 'azure-devops', url: item.url },
      item.taskSourceContext
    )
  ) {
    return false
  }
  useAppStore.getState().openTaskPage({
    taskSource: 'azure-devops',
    openAzureDevOpsWorkItem: {
      number: item.number,
      url: item.url,
      sourceContext: item.taskSourceContext
    }
  })
  return true
}
