import { useAppStore } from '@/store'

export function showWorkspaceSessionChooser(worktreeId: string): void {
  const state = useAppStore.getState()
  if (state.reconcileWorktreeTabModel(worktreeId).renderableTabCount > 0) {
    return
  }
  const groupId = state.ensureWorktreeRootGroup(worktreeId)
  useAppStore.setState((current) => ({
    splitLandingGroupIds: { ...current.splitLandingGroupIds, [groupId]: worktreeId }
  }))
}
