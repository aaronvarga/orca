import type { AppState } from '@/store/types'
import {
  nativeChatTabActivation,
  resolveNativeChatTabSplit
} from '../../../../../shared/native-chat/layout/native-chat-tab-splits'

type ChatTabNavigationState = Pick<
  AppState,
  'nativeChatTabSplits' | 'unifiedTabsByWorktree' | 'groupsByWorktree'
>

export function nativeChatTabToActivate(
  state: ChatTabNavigationState,
  worktreeId: string,
  tabId: string
) {
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const groupId = tabs.find((tab) => tab.id === tabId)?.groupId
  const recent = state.groupsByWorktree[worktreeId]?.find(
    (group) => group.id === groupId
  )?.recentTabIds
  const selected = nativeChatTabActivation(state.nativeChatTabSplits, tabs, tabId, recent)
  return tabs.find((tab) => tab.id === selected)
}

export function nativeChatTabContainer(
  state: ChatTabNavigationState,
  worktreeId: string,
  tabId: string
) {
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const container =
    resolveNativeChatTabSplit(state.nativeChatTabSplits, tabs, tabId)?.rootTabId ?? tabId
  return tabs.find((tab) => tab.id === container)
}
