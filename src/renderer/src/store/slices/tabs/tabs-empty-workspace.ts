import type { AppState } from '../../types'
import { workspaceEditorFiles } from '../editor/tabs/workspace-editor-files'
import { hasSplitLandingGroup } from './split-landing-groups'

// Last user-close shows the workspace chooser; failed-create cleanup preserves selection.
type LandingState = Pick<
  AppState,
  | 'activeWorktreeId'
  | 'unifiedTabsByWorktree'
  | 'tabsByWorktree'
  | 'browserTabsByWorktree'
  | 'openFiles'
  | 'activeTabIdByWorktree'
  | 'activeBrowserTabIdByWorktree'
  | 'activeFileIdByWorktree'
  | 'activeTabTypeByWorktree'
  | 'activeGroupIdByWorktree'
  | 'groupsByWorktree'
  | 'splitLandingGroupIds'
>

export function landsOnEmptiedWorktree(
  current: LandingState,
  worktreeId: string,
  remainingTabs: number
): boolean {
  return (
    current.activeWorktreeId === worktreeId &&
    remainingTabs === 0 &&
    (current.tabsByWorktree[worktreeId] ?? []).length === 0 &&
    (current.browserTabsByWorktree[worktreeId] ?? []).length === 0 &&
    workspaceEditorFiles(current.openFiles, current.unifiedTabsByWorktree[worktreeId]).length ===
      0 &&
    !hasSplitLandingGroup(current, worktreeId)
  )
}

export function emptiedWorktreeLandingPatch(current: LandingState, worktreeId: string) {
  const groupId =
    current.activeGroupIdByWorktree[worktreeId] ?? current.groupsByWorktree[worktreeId]?.[0]?.id
  return {
    ...(groupId
      ? { splitLandingGroupIds: { ...current.splitLandingGroupIds, [groupId]: worktreeId } }
      : {}),
    activeTabId: null,
    activeBrowserTabId: null,
    activeFileId: null,
    activeTabType: 'terminal' as const,
    activeTabIdByWorktree: { ...current.activeTabIdByWorktree, [worktreeId]: null },
    activeBrowserTabIdByWorktree: { ...current.activeBrowserTabIdByWorktree, [worktreeId]: null },
    activeFileIdByWorktree: { ...current.activeFileIdByWorktree, [worktreeId]: null },
    activeTabTypeByWorktree: {
      ...current.activeTabTypeByWorktree,
      [worktreeId]: 'terminal' as const
    }
  }
}

type LandingSet = (update: (state: AppState) => Partial<AppState>) => void

/** After main's frame dropped a closed tab: lands when that emptied the active worktree. */
export function landOnEmptiedWorktree(
  set: LandingSet,
  get: () => AppState,
  worktreeId: string
): boolean {
  const state = get()
  if (
    !landsOnEmptiedWorktree(
      state,
      worktreeId,
      (state.unifiedTabsByWorktree[worktreeId] ?? []).length
    )
  ) {
    return false
  }
  get().ensureWorktreeRootGroup(worktreeId)
  set((current) => emptiedWorktreeLandingPatch(current, worktreeId))
  return true
}
