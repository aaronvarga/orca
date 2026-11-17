import { expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { equalizeWorkspacePanes } from './equalize-workspace-panes'
it('equalizes three adjacent workspace panes without changing pane identities', () => {
  useAppStore.setState({
    layoutByWorktree: {
      workspace: {
        type: 'split',
        direction: 'horizontal',
        ratio: 0.8,
        first: { type: 'leaf', groupId: 'a' },
        second: {
          type: 'split',
          direction: 'horizontal',
          ratio: 0.7,
          first: { type: 'leaf', groupId: 'b' },
          second: { type: 'leaf', groupId: 'c' }
        }
      }
    }
  })
  equalizeWorkspacePanes('workspace')
  expect(useAppStore.getState().layoutByWorktree.workspace).toEqual({
    type: 'split',
    direction: 'horizontal',
    ratio: 0.3333333333333333,
    first: { type: 'leaf', groupId: 'a' },
    second: {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      first: { type: 'leaf', groupId: 'b' },
      second: { type: 'leaf', groupId: 'c' }
    }
  })
})
