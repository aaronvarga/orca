import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'
import { structuredAgentSessionOwnerForTab } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { afterPendingTab } from '@/runtime/workspace-layout/intents/layout-owner-pending-tabs'
import { createNonSecureContextUuid } from '../../../../../../shared/identifiers/non-secure-context-uuid'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { TabGroupLayoutNode } from '../../../../../../shared/workspace-layout/tab-groups/tab-types'
import {
  buildSplitNode,
  equalizeTabGroupLayout,
  replaceLeaf
} from '../../../../../../shared/workspace-layout/tab-groups/tab-group-layout-tree'
import {
  nativeChatSplitTabIds,
  resolveNativeChatTabSplit
} from '../../../../../../shared/native-chat/layout/native-chat-tab-splits'
import { requestNativeChatComposerFocus } from '../../composer/focus/native-chat-composer-focus-intent'

export function splitNativeChatTab(
  worktreeId: string,
  tabId: string,
  direction: 'left' | 'right' | 'down'
): boolean {
  const state = useAppStore.getState()
  const source = state.unifiedTabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)
  if (!source || source.contentType !== 'agent-session' || !isTuiAgent(source.agentSessionAgent)) {
    return false
  }
  const executionHostId = structuredAgentSessionOwnerForTab(state, source)
  if (!executionHostId) {
    return false
  }
  const place = (openedId: string | null) => {
    if (!openedId) {
      return
    }
    afterPendingTab(openedId, (drawnId) => {
      if (!drawnId) {
        return
      }
      const current = useAppStore.getState()
      const tabs = current.unifiedTabsByWorktree[worktreeId] ?? []
      const origin = tabs.find((tab) => tab.id === tabId)
      const opened = tabs.find((tab) => tab.id === drawnId)
      if (!origin || !opened || origin.groupId !== opened.groupId) {
        return
      }
      const split = resolveNativeChatTabSplit(current.nativeChatTabSplits, tabs, tabId)
      if (split?.tabIds.includes(drawnId)) {
        return
      }
      const layout: TabGroupLayoutNode = split?.layout ?? { type: 'leaf', groupId: tabId }
      const replacement = buildSplitNode(
        tabId,
        drawnId,
        direction === 'down' ? 'vertical' : 'horizontal',
        direction === 'left' ? 'first' : 'second'
      )
      const records = Object.fromEntries(
        Object.entries(current.nativeChatTabSplits ?? {}).filter(
          ([key, record]) =>
            key === split?.key ||
            record.executionHostId !== executionHostId ||
            !nativeChatSplitTabIds(record.layout).some((id) => id === tabId || id === drawnId)
        )
      )
      current.setNativeChatTabSplits({
        ...records,
        [split?.key ?? tabId]: {
          executionHostId,
          layout: equalizeTabGroupLayout(replaceLeaf(layout, tabId, replacement))
        }
      })
      const selected = current.groupsByWorktree[worktreeId]?.find(
        (group) => group.id === origin.groupId
      )?.activeTabId
      if (
        current.activeWorktreeId === worktreeId &&
        current.activeGroupIdByWorktree[worktreeId] === origin.groupId &&
        (selected === tabId ||
          selected === drawnId ||
          (selected && split?.tabIds.includes(selected)))
      ) {
        current.activateTab(drawnId, { worktreeId })
        requestNativeChatComposerFocus(drawnId)
      }
    })
  }
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan: adoptAgentSessionLaunchVerdict({
      route: 'structured-native-chat',
      requestId: createNonSecureContextUuid(),
      agent: source.agentSessionAgent,
      worktreeId,
      executionHostId,
      requestedSurface: 'chat'
    }),
    target: { worktreeId, executionHostId },
    targetGroupId: source.groupId,
    afterTabId: source.id,
    hooks: {
      beforeCreate: () =>
        useAppStore
          .getState()
          .unifiedTabsByWorktree[worktreeId]?.some(
            (tab) =>
              tab.id === source.id &&
              tab.entityId === source.entityId &&
              tab.executionHostId === source.executionHostId
          ) === true
    },
    onTabOpenSettled: place,
    onHostDeclined: () => ({ opened: false })
  })
  if (!launch) {
    return false
  }
  if (launch.tab) {
    place(launch.tab.id)
  }
  void launch.settlement.then((result) => {
    if ((result.kind === 'failed' && !result.notified) || result.kind === 'terminal') {
      toast.error(translate('chatSplits.failed', 'Could not split this chat.'))
    }
  })
  return true
}

export function equalizeNativeChatTab(worktreeId: string, tabId: string): boolean {
  const state = useAppStore.getState()
  const split = resolveNativeChatTabSplit(
    state.nativeChatTabSplits,
    state.unifiedTabsByWorktree[worktreeId] ?? [],
    tabId
  )
  if (!split) {
    return false
  }
  state.setNativeChatTabSplits({
    ...state.nativeChatTabSplits,
    [split.key]: {
      ...state.nativeChatTabSplits![split.key],
      layout: equalizeTabGroupLayout(split.layout)
    }
  })
  return true
}
