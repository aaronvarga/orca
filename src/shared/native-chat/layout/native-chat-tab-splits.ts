import { parseExecutionHostId, type ExecutionHostId } from '../../execution-host/execution-host'
import type { Tab, TabGroupLayoutNode } from '../../workspace-layout/tab-groups/tab-types'
import { parseOrphanGroupLayout } from '../../rpc-contract/terminal/terminal-orphan-params'
import { equalizeTabGroupLayout } from '../../workspace-layout/tab-groups/tab-group-layout-tree'
import { collectTabGroupLayoutGroupIds } from '../../workspace-layout/tab-groups/tab-group-moves'

export type NativeChatTabSplits = Record<
  string,
  { executionHostId: ExecutionHostId; layout: TabGroupLayoutNode }
>

export function normalizeNativeChatTabSplits(value: unknown): NativeChatTabSplits {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const claimed = new Set<string>()
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, record]) => {
      if (
        !record ||
        typeof record !== 'object' ||
        !('layout' in record) ||
        !('executionHostId' in record)
      ) {
        return []
      }
      const host =
        typeof record.executionHostId === 'string'
          ? parseExecutionHostId(record.executionHostId)
          : null
      const layout = parseOrphanGroupLayout(record.layout)
      if (!layout || !host) {
        return []
      }
      const members = nativeChatSplitTabIds(layout).map((id) => `${host.id}:${id}`)
      if (members.some((id) => claimed.has(id))) {
        return []
      }
      for (const id of members) {
        claimed.add(id)
      }
      return [[key, { executionHostId: host.id, layout }]]
    })
  )
}

export function nativeChatSplitTabIds(node: TabGroupLayoutNode): string[] {
  return [...collectTabGroupLayoutGroupIds(node)]
}

/** Sessions keep their host-owned tab records; only their presentation is grouped. */
export function resolveNativeChatTabSplit(
  splits: NativeChatTabSplits | undefined,
  tabs: readonly Tab[],
  tabId: string
): { key: string; rootTabId: string; layout: TabGroupLayoutNode; tabIds: string[] } | null {
  const source = tabs.find((tab) => tab.id === tabId && tab.contentType === 'agent-session')
  if (!source) {
    return null
  }
  const prune = (
    node: TabGroupLayoutNode,
    seen: Set<string>,
    available: Set<string>
  ): TabGroupLayoutNode | null => {
    if (node.type === 'leaf') {
      if (!available.has(node.groupId) || seen.has(node.groupId)) {
        return null
      }
      seen.add(node.groupId)
      return node
    }
    const first = prune(node.first, seen, available)
    const second = prune(node.second, seen, available)
    return first && second ? { ...node, first, second } : (first ?? second)
  }
  for (const [key, record] of Object.entries(splits ?? {})) {
    if (
      !nativeChatSplitTabIds(record.layout).includes(tabId) ||
      (source.executionHostId && source.executionHostId !== record.executionHostId)
    ) {
      continue
    }
    const available = new Set(
      tabs
        .filter(
          (tab) =>
            tab.contentType === 'agent-session' &&
            tab.groupId === source.groupId &&
            tab.worktreeId === source.worktreeId &&
            (!tab.executionHostId || tab.executionHostId === record.executionHostId)
        )
        .map((tab) => tab.id)
    )
    const layout = prune(record.layout, new Set(), available)
    if (!layout) {
      continue
    }
    const tabIds = nativeChatSplitTabIds(layout)
    if (tabIds.length > 1 && tabIds.includes(tabId)) {
      return {
        key,
        rootTabId: tabIds.includes(key) ? key : tabIds[0],
        layout:
          tabIds.length === nativeChatSplitTabIds(record.layout).length
            ? layout
            : equalizeTabGroupLayout(layout),
        tabIds
      }
    }
  }
  return null
}

export function nativeChatPaneAnchorId(tabId: string): string {
  return `chat-pane:${tabId}`
}

export function nativeChatTabActivation(
  splits: NativeChatTabSplits | undefined,
  tabs: readonly Tab[],
  tabId: string,
  recentTabIds: readonly string[] | undefined
): string {
  const split = resolveNativeChatTabSplit(splits, tabs, tabId)
  return split && split.rootTabId === tabId
    ? (recentTabIds?.findLast((id) => split.tabIds.includes(id)) ?? tabId)
    : tabId
}
