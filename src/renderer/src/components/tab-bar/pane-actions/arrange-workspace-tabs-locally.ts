import { useAppStore } from '@/store'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { arrangeTabGroups } from '../../../../../shared/workspace-layout/tab-groups/arrange-tab-groups'
import { collectTabGroupLayoutGroupIds } from '../../../../../shared/workspace-layout/tab-groups/tab-group-moves'
import type { TabGroupLayoutNode } from '../../../../../shared/workspace-layout/tab-groups/tab-types'

export function arrangeWorkspaceTabsLocally(
  worktreeId: string,
  columns: number,
  rows: number
): boolean {
  const state = useAppStore.getState()
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const currentGroups = state.groupsByWorktree[worktreeId] ?? []
  const order = [...collectTabGroupLayoutGroupIds(state.layoutByWorktree[worktreeId])]
  const groups = [...currentGroups].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  const arranged = arrangeTabGroups(
    groups,
    new Set(tabs.map((tab) => tab.id)),
    columns,
    rows,
    createNonSecureContextUuid
  )
  if (!arranged) {
    return false
  }
  const activeTabId = groups.find(
    (group) => group.id === state.activeGroupIdByWorktree[worktreeId]
  )?.activeTabId
  const rootId = groups[0].id
  for (const tab of tabs) {
    state.moveUnifiedTabToGroup(tab.id, rootId, { recordInteraction: false })
  }
  for (const group of groups) {
    state.closeEmptyGroup(worktreeId, group.id)
  }
  const members = (node: TabGroupLayoutNode): string[] =>
    node.type === 'leaf'
      ? arranged.groups.find((group) => group.id === node.groupId)!.tabOrder
      : [...members(node.first), ...members(node.second)]
  const split = (node: TabGroupLayoutNode, groupId: string, path: string): boolean => {
    if (node.type === 'leaf') {
      state.activateTab(members(node)[0], { worktreeId, recordFocus: false })
      return true
    }
    const secondId = state.createEmptySplitGroup(
      worktreeId,
      groupId,
      node.direction === 'horizontal' ? 'right' : 'down',
      { activate: false }
    )
    if (!secondId) {
      return false
    }
    for (const tabId of members(node.second)) {
      state.moveUnifiedTabToGroup(tabId, secondId, { activate: true, recordInteraction: false })
    }
    state.setTabGroupSplitRatio(worktreeId, path, node.ratio ?? 0.5)
    return (
      split(node.first, groupId, path ? `${path}.first` : 'first') &&
      split(node.second, secondId, path ? `${path}.second` : 'second')
    )
  }
  const applied = split(arranged.layout, rootId, '')
  if (activeTabId) {
    state.activateTab(activeTabId, { worktreeId, recordFocus: false })
  }
  return applied
}
