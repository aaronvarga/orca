import { expect, it, vi } from 'vitest'
import { createTestStore, seedStore } from '@/store/testing/app-store-test-fixture'
import { makeUnifiedTab, makeTabGroup } from '@/store/slices/tabs/tab-group.test-fixture'
import type { TabGroupLayoutNode } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { arrangeWorkspaceTabsLocally } from './arrange-workspace-tabs-locally'

const mocks = vi.hoisted((): { store: ReturnType<typeof createTestStore> | null } => ({
  store: null
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.store!.getState() } }))

it('arranges every open tab into equal rows and columns while retaining the selected tab', () => {
  const store = createTestStore()
  mocks.store = store
  seedStore(store, {
    activeWorktreeId: 'workspace',
    unifiedTabsByWorktree: {
      workspace: ['a', 'b', 'c', 'd'].map((id) =>
        makeUnifiedTab({ id, worktreeId: 'workspace', groupId: 'root' })
      )
    },
    groupsByWorktree: {
      workspace: [
        makeTabGroup({
          id: 'root',
          worktreeId: 'workspace',
          activeTabId: 'c',
          tabOrder: ['a', 'b', 'c', 'd']
        })
      ]
    },
    layoutByWorktree: { workspace: { type: 'leaf', groupId: 'root' } },
    activeGroupIdByWorktree: { workspace: 'root' }
  })
  expect(arrangeWorkspaceTabsLocally('workspace', 2, 2)).toBe(true)
  const state = store.getState()
  const drawing = (node: TabGroupLayoutNode): unknown =>
    node.type === 'leaf'
      ? state.groupsByWorktree.workspace.find((group) => group.id === node.groupId)!.tabOrder
      : {
          direction: node.direction,
          ratio: node.ratio,
          first: drawing(node.first),
          second: drawing(node.second)
        }
  expect(drawing(state.layoutByWorktree.workspace)).toEqual({
    direction: 'vertical',
    ratio: 0.5,
    first: { direction: 'horizontal', ratio: 0.5, first: ['a'], second: ['b'] },
    second: { direction: 'horizontal', ratio: 0.5, first: ['c'], second: ['d'] }
  })
  expect(
    state.groupsByWorktree.workspace.find(
      (group) => group.id === state.activeGroupIdByWorktree.workspace
    )?.activeTabId
  ).toBe('c')
  expect(arrangeWorkspaceTabsLocally('workspace', 1, 1)).toBe(true)
  expect(store.getState().groupsByWorktree.workspace).toHaveLength(1)
  expect(store.getState().unifiedTabsByWorktree.workspace.map((tab) => tab.id)).toEqual([
    'a',
    'b',
    'c',
    'd'
  ])
})
