import type { ExecutionHostId } from '../../execution-host/execution-host'
import { expect, it } from 'vitest'
import type { Tab } from '../../workspace-layout/tab-groups/tab-types'
import {
  nativeChatTabActivation,
  normalizeNativeChatTabSplits,
  resolveNativeChatTabSplit
} from './native-chat-tab-splits'

const saved = {
  first: {
    executionHostId: 'local',
    layout: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.4,
      first: { type: 'leaf', groupId: 'first' },
      second: {
        type: 'split',
        direction: 'vertical',
        ratio: 0.6,
        first: { type: 'leaf', groupId: 'second' },
        second: { type: 'leaf', groupId: 'third' }
      }
    }
  }
}
const tab = (id: string, executionHostId: ExecutionHostId = 'local'): Tab => ({
  id,
  entityId: id,
  executionHostId,
  contentType: 'agent-session',
  agentSessionAgent: 'claude',
  groupId: 'group',
  worktreeId: 'folder:notes',
  label: id,
  customLabel: null,
  color: null,
  sortOrder: 0,
  createdAt: 1
})

it('keeps saved proportions until a closed session makes the remaining panes equalize', () => {
  const restored = normalizeNativeChatTabSplits(JSON.parse(JSON.stringify(saved)))
  expect(
    resolveNativeChatTabSplit(restored, [tab('first'), tab('second'), tab('third')], 'first')
      ?.layout
  ).toEqual(saved.first.layout)
  const split = resolveNativeChatTabSplit(restored, [tab('first'), tab('third')], 'third')
  expect(split).toEqual({
    key: 'first',
    rootTabId: 'first',
    tabIds: ['first', 'third'],
    layout: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'first' },
      second: { type: 'leaf', groupId: 'third' }
    }
  })
  expect(resolveNativeChatTabSplit(restored, [tab('third')], 'third')).toBeNull()
  expect(
    nativeChatTabActivation(restored, [tab('first'), tab('third')], 'first', ['first', 'third'])
  ).toBe('third')
})

it('keeps unrelated hosts and malformed saved layouts out of a split', () => {
  const restored = normalizeNativeChatTabSplits({
    ...saved,
    broken: { executionHostId: 'local', layout: { type: 'split', direction: 'diagonal' } }
  })
  expect(Object.keys(restored)).toEqual(['first'])
  expect(
    resolveNativeChatTabSplit(restored, [tab('first'), tab('second', 'runtime:other')], 'first')
  ).toBeNull()
  expect(
    resolveNativeChatTabSplit(
      restored,
      [tab('first'), { ...tab('second'), groupId: 'other' }],
      'first'
    )
  ).toBeNull()
})

it('rejects overlapping saved groups so a session cannot hide two different tabs', () => {
  const restored = normalizeNativeChatTabSplits({
    ...saved,
    duplicate: {
      executionHostId: 'local',
      layout: {
        type: 'split',
        direction: 'vertical',
        first: { type: 'leaf', groupId: 'second' },
        second: { type: 'leaf', groupId: 'fourth' }
      }
    }
  })
  expect(Object.keys(restored)).toEqual(['first'])
})
