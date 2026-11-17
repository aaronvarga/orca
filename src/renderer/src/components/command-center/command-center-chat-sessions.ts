import type { ExecutionHostDisplayState } from '@/runtime/hosts/display/execution-host-display-label'
import type { WorktreeRuntimeOwnerState } from '@/lib/workspace/ownership/worktree-runtime-owner-state'
import type { AppState } from '@/store/types'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForTab
} from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { readStructuredChatTabName } from '@/runtime/native-chat/naming/structured-chat-tab-name'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { CommandCenterChatTile } from './CommandCenterView'

export function commandCenterChatSessions(
  state: Pick<
    AppState,
    'repos' | 'projectGroups' | 'unifiedTabsByWorktree' | 'getKnownWorktreeById'
  > &
    Omit<
      WorktreeRuntimeOwnerState,
      'repos' | 'projectGroups' | 'settings' | 'runtimeEnvironments'
    > &
    ExecutionHostDisplayState
): CommandCenterChatTile[] {
  return Object.values(state.unifiedTabsByWorktree).flatMap((tabs) =>
    tabs.flatMap((tab) => {
      if (tab.contentType !== 'agent-session' || !tab.agentSessionAgent) {
        return []
      }
      const owner = structuredAgentSessionOwnerForTab(state, tab)
      const target = structuredAgentSessionTargetForTab(state, tab)
      if (!owner || !target) {
        return []
      }
      const workspace = state.getKnownWorktreeById(tab.worktreeId, owner)
      if (!workspace || workspace.isArchived) {
        return []
      }
      const repo = state.repos.find(
        (repo) => repo.id === workspace.repoId && getRepoExecutionHostId(repo) === owner
      )
      const group = state.projectGroups.find(
        (group) =>
          folderWorkspaceRepoId(group.id) === workspace.repoId &&
          getRepoExecutionHostId(group) === owner
      )
      return [
        {
          kind: 'chat' as const,
          id: JSON.stringify([owner, 'chat', tab.entityId]),
          ownerId: owner,
          repoId: workspace.repoId,
          repo,
          projectName: group?.name,
          projectColor: group?.color,
          projectIcon: group?.repoIcon,
          hostLabel: selectExecutionHostDisplayLabel(state, owner),
          available: true,
          title: readStructuredChatTabName(tab, state),
          tab,
          chat: {
            mode: 'structured' as const,
            tabId: tab.id,
            groupId: tab.groupId,
            sessionId: tab.entityId,
            target,
            agent: tab.agentSessionAgent,
            isVisible: true,
            isFocusedGroup: false
          }
        }
      ]
    })
  )
}
