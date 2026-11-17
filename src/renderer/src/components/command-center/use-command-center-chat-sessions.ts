import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  selectWorktreesByRepo,
  selectFolderWorkspaces,
  selectDetectedWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { commandCenterChatSessions } from './command-center-chat-sessions'

export function useCommandCenterChatSessions() {
  const catalog = useAppStore(
    useShallow((state) => ({
      repos: state.repos,
      projectGroups: state.projectGroups,
      settings: state.settings,
      sshConnectionStates: state.sshConnectionStates,
      sshTargetLabels: state.sshTargetLabels,
      removedSshTargetLabels: state.removedSshTargetLabels,
      sshTargetsHydrated: state.sshTargetsHydrated,
      sshStateByEnvironment: state.sshStateByEnvironment,
      runtimeStatusByEnvironmentId: state.runtimeStatusByEnvironmentId,
      runtimeEnvironments: state.runtimeEnvironments,
      runtimeEnvironmentCatalogHydrated: state.runtimeEnvironmentCatalogHydrated,
      removedRuntimeEnvironmentIds: state.removedRuntimeEnvironmentIds,
      restoredRuntimeHostIdByWorkspaceSessionKey: state.restoredRuntimeHostIdByWorkspaceSessionKey,
      activeWorktreeId: state.activeWorktreeId,
      activeWorkspaceExecutionHostId: state.activeWorkspaceExecutionHostId,
      unifiedTabsByWorktree: state.unifiedTabsByWorktree,
      getKnownWorktreeById: state.getKnownWorktreeById,
      worktreesByRepo: selectWorktreesByRepo(state),
      folderWorkspaces: selectFolderWorkspaces(state),
      detectedWorktreesByRepo: selectDetectedWorktreesByRepo(state)
    }))
  )
  return useMemo(() => commandCenterChatSessions(catalog), [catalog])
}
