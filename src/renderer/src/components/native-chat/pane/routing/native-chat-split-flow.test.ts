// @vitest-environment happy-dom
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { createTabsSliceMockApi } from '@/store/slices/tabs/tabs-slice-test-harness'
import { dispatchWorkspaceTabCommand } from '@/lib/workspace/tabs/workspace-tab-commands'
import { beforeEach, expect, it, vi } from 'vitest'
import { createTestStore, seedStore } from '@/store/testing/app-store-test-fixture'
import { makeUnifiedTab, makeTabGroup } from '@/store/slices/tabs/tab-group.test-fixture'
import type { ProvisionalLaunchArgs } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { folderWorkspaceKey } from '../../../../../../shared/workspace/identity/workspace-scope'
import { resolveNativeChatTabSplit } from '../../../../../../shared/native-chat/layout/native-chat-tab-splits'

let store: ReturnType<typeof createTestStore>
const mocks = vi.hoisted(() => ({ launch: vi.fn(), focus: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => store.getState() } }))
vi.mock('@/store/index', () => ({ useAppStore: { getState: () => store.getState() } }))
vi.mock('@/lib/agent-session/structured-agent-session-provisional-tab', () => ({
  beginStructuredAgentSessionProvisionalLaunch: mocks.launch
}))
vi.mock('@/runtime/workspace-layout/intents/layout-owner-pending-tabs', () => ({
  afterPendingTab: (id: string, ready: (id: string) => void) => ready(id)
}))
vi.mock('../../composer/focus/native-chat-composer-focus-intent', () => ({
  requestNativeChatComposerFocus: mocks.focus
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { runNativeChatSplitTarget } from './native-chat-layout-actions'
import { splitNativeChatTab } from './native-chat-tab-split-actions'

createTabsSliceMockApi()
const workspace = folderWorkspaceKey('meeting')
beforeEach(() => {
  vi.clearAllMocks()
  store = createTestStore()
  seedStore(store, {
    settings: {
      ...getDefaultSettings('/test-home'),
      skipCloseTerminalWithRunningProcessConfirm: true
    },
    activeWorktreeId: workspace,
    activeGroupIdByWorktree: { [workspace]: 'group' },
    groupsByWorktree: {
      [workspace]: [
        makeTabGroup({
          id: 'group',
          worktreeId: workspace,
          tabOrder: ['source'],
          activeTabId: 'source'
        })
      ]
    },
    unifiedTabsByWorktree: {
      [workspace]: [
        makeUnifiedTab({
          id: 'source',
          entityId: 'source-session',
          worktreeId: workspace,
          groupId: 'group',
          contentType: 'agent-session',
          agentSessionAgent: 'codex',
          executionHostId: 'runtime:remote-host'
        })
      ]
    }
  })
})

it('opens an independent chat on the source host inside its tab, and places a repeated publication once', () => {
  mocks.launch.mockImplementation((args: ProvisionalLaunchArgs) => {
    const tab = store.getState().createUnifiedTab(workspace, 'agent-session', {
      id: 'new-chat',
      entityId: 'new-session',
      agentSessionAgent: 'codex',
      executionHostId: 'runtime:remote-host',
      targetGroupId: 'group',
      activate: false
    })
    args.onTabOpenSettled?.(tab.id)
    return { tab, settlement: Promise.resolve({ kind: 'structured', sessionId: 'new-session' }) }
  })
  expect(
    runNativeChatSplitTarget(
      { kind: 'workspace-tab', unifiedTabId: 'source', groupId: 'group' },
      'right'
    )
  ).toBe(true)
  expect(mocks.launch.mock.calls[0][0]).toMatchObject({
    target: { worktreeId: 'folder:meeting', executionHostId: 'runtime:remote-host' },
    plan: { agent: 'codex', requestedSurface: 'chat' }
  })
  const state = store.getState()
  const split = resolveNativeChatTabSplit(
    state.nativeChatTabSplits,
    state.unifiedTabsByWorktree[workspace],
    'new-chat'
  )
  expect(split).toEqual({
    key: 'source',
    rootTabId: 'source',
    tabIds: ['source', 'new-chat'],
    layout: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'source' },
      second: { type: 'leaf', groupId: 'new-chat' }
    }
  })
  expect(state.unifiedTabsByWorktree[workspace].map((tab) => [tab.entityId, tab.groupId])).toEqual([
    ['source-session', 'group'],
    ['new-session', 'group']
  ])
})

it('does not hide a late chat when its original tab was closed', () => {
  let published: ProvisionalLaunchArgs['onTabOpenSettled']
  mocks.launch.mockImplementation((args: ProvisionalLaunchArgs) => {
    published = args.onTabOpenSettled
    return {
      tab: null,
      settlement: Promise.resolve({ kind: 'visibility-unknown', sessionId: 'late-session' })
    }
  })
  runNativeChatSplitTarget(
    { kind: 'workspace-tab', unifiedTabId: 'source', groupId: 'group' },
    'down'
  )
  store.setState({
    unifiedTabsByWorktree: {
      [workspace]: [
        makeUnifiedTab({
          id: 'late-chat',
          entityId: 'late-session',
          worktreeId: workspace,
          groupId: 'group',
          contentType: 'agent-session',
          executionHostId: 'runtime:remote-host'
        })
      ]
    }
  })
  published?.('late-chat')
  expect(store.getState().nativeChatTabSplits).toEqual({})
  expect(store.getState().unifiedTabsByWorktree[workspace].map((tab) => tab.id)).toEqual([
    'late-chat'
  ])
})

it('closes only the requested pane, and closes all sibling sessions when closing their outer tab', () => {
  const source = store.getState().unifiedTabsByWorktree[workspace][0]
  const child = { ...source, id: 'child', entityId: 'child-session' }
  const unrelated = { ...source, id: 'other', entityId: 'other-session' }
  store.setState({
    unifiedTabsByWorktree: { [workspace]: [source, child, unrelated] },
    groupsByWorktree: {
      [workspace]: [
        makeTabGroup({
          id: 'group',
          worktreeId: workspace,
          activeTabId: 'child',
          tabOrder: ['source', 'child', 'other']
        })
      ]
    },
    nativeChatTabSplits: {
      source: {
        executionHostId: 'runtime:remote-host',
        layout: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'source' },
          second: { type: 'leaf', groupId: 'child' }
        }
      }
    }
  })
  dispatchWorkspaceTabCommand({
    type: 'close',
    target: { kind: 'tab', worktreeId: workspace, tabId: 'child' },
    chatPaneOnly: true
  })
  expect(store.getState().unifiedTabsByWorktree[workspace].map((tab) => tab.entityId)).toEqual([
    'source-session',
    'other-session'
  ])
  store.setState({
    unifiedTabsByWorktree: { [workspace]: [source, child, unrelated] },
    groupsByWorktree: {
      [workspace]: [
        makeTabGroup({
          id: 'group',
          worktreeId: workspace,
          activeTabId: 'source',
          tabOrder: ['source', 'child', 'other']
        })
      ]
    }
  })
  dispatchWorkspaceTabCommand({
    type: 'close',
    target: { kind: 'tab', worktreeId: workspace, tabId: 'source' }
  })
  expect(store.getState().unifiedTabsByWorktree[workspace].map((tab) => tab.entityId)).toEqual([
    'other-session'
  ])
})

it.each([
  {
    direction: 'left',
    expected: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'new-chat' },
      second: { type: 'leaf', groupId: 'source' }
    }
  },
  {
    direction: 'down',
    expected: {
      type: 'split',
      direction: 'vertical',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'source' },
      second: { type: 'leaf', groupId: 'new-chat' }
    }
  }
] satisfies { direction: 'left' | 'down'; expected: unknown }[])(
  'splits the current chat $direction while retaining its outer tab',
  ({ direction, expected }) => {
    mocks.launch.mockImplementation((args: ProvisionalLaunchArgs) => {
      const source = store.getState().unifiedTabsByWorktree[workspace][0]
      const tab = { ...source, id: 'new-chat', entityId: 'new-session' }
      store.setState({ unifiedTabsByWorktree: { [workspace]: [source, tab] } })
      args.onTabOpenSettled?.(tab.id)
      return { tab, settlement: Promise.resolve({ kind: 'structured', sessionId: 'new-session' }) }
    })
    splitNativeChatTab(workspace, 'source', direction)
    const state = store.getState()
    const split = resolveNativeChatTabSplit(
      state.nativeChatTabSplits,
      state.unifiedTabsByWorktree[workspace],
      'new-chat'
    )
    expect(split?.rootTabId).toBe('source')
    expect(split?.layout).toEqual(expected)
  }
)

it('equalizes every adjacent session when another split is added', () => {
  const source = store.getState().unifiedTabsByWorktree[workspace][0]
  const child = { ...source, id: 'child', entityId: 'child-session' }
  store.setState({
    unifiedTabsByWorktree: { [workspace]: [source, child] },
    nativeChatTabSplits: {
      source: {
        executionHostId: 'runtime:remote-host',
        layout: {
          type: 'split',
          direction: 'horizontal',
          ratio: 0.8,
          first: { type: 'leaf', groupId: 'source' },
          second: { type: 'leaf', groupId: 'child' }
        }
      }
    }
  })
  mocks.launch.mockImplementation((args: ProvisionalLaunchArgs) => {
    const tab = { ...source, id: 'third', entityId: 'third-session' }
    store.setState({ unifiedTabsByWorktree: { [workspace]: [source, child, tab] } })
    args.onTabOpenSettled?.(tab.id)
    return { tab, settlement: Promise.resolve({ kind: 'structured', sessionId: 'third-session' }) }
  })
  splitNativeChatTab(workspace, 'child', 'right')
  expect(store.getState().nativeChatTabSplits?.source.layout).toEqual({
    type: 'split',
    direction: 'horizontal',
    ratio: 0.3333333333333333,
    first: { type: 'leaf', groupId: 'source' },
    second: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'child' },
      second: { type: 'leaf', groupId: 'third' }
    }
  })
})
