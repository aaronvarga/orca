import { useAppStore } from '@/store'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { arrangeTabGroups } from '../../../../../shared/workspace-layout/tab-groups/arrange-tab-groups'
import { buildActiveSurfacePatch } from '@/store/slices/tabs/tabs-surface'

export function arrangeWorkspaceTabsLocally(
  worktreeId: string,
  columns: number,
  rows: number
): boolean {
  const current = useAppStore.getState()
  const currentTabs = current.unifiedTabsByWorktree[worktreeId] ?? []
  const groups = current.groupsByWorktree[worktreeId] ?? []
  const arranged = arrangeTabGroups(
    groups,
    new Set(currentTabs.map((tab) => tab.id)),
    columns,
    rows,
    createNonSecureContextUuid
  )
  if (!arranged) {
    return false
  }
  const activeTabId = groups.find(
    (group) => group.id === current.activeGroupIdByWorktree[worktreeId]
  )?.activeTabId
  const nextGroups = arranged.groups.map((group) => ({
    ...group,
    worktreeId,
    activeTabId:
      activeTabId && group.tabOrder.includes(activeTabId) ? activeTabId : group.tabOrder[0]
  }))
  const nextTabs = currentTabs.map((tab) => ({
    ...tab,
    groupId: nextGroups.find((group) => group.tabOrder.includes(tab.id))!.id
  }))
  const activeGroupId =
    nextGroups.find((group) => group.activeTabId === activeTabId)?.id ?? nextGroups[0].id
  const patch = {
    groupsByWorktree: { ...current.groupsByWorktree, [worktreeId]: nextGroups },
    unifiedTabsByWorktree: { ...current.unifiedTabsByWorktree, [worktreeId]: nextTabs },
    layoutByWorktree: { ...current.layoutByWorktree, [worktreeId]: arranged.layout },
    activeGroupIdByWorktree: { ...current.activeGroupIdByWorktree, [worktreeId]: activeGroupId }
  }
  useAppStore.setState({
    ...patch,
    ...buildActiveSurfacePatch({ ...current, ...patch }, worktreeId, activeGroupId)
  })
  return true
}
