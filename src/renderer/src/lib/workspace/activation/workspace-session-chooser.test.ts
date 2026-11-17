import { expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { showWorkspaceSessionChooser } from './workspace-session-chooser'
import { shouldSeedDefaultSurface } from './initial-surface/automatic-default-surface'

it('keeps an empty selected workspace on its chooser instead of seeding a shell', () => {
  useAppStore.setState({
    tabsByWorktree: {},
    unifiedTabsByWorktree: {},
    groupsByWorktree: {},
    layoutByWorktree: {},
    activeGroupIdByWorktree: {},
    splitLandingGroupIds: {},
    browserTabsByWorktree: {},
    openFiles: []
  })
  showWorkspaceSessionChooser('empty-project')
  expect(shouldSeedDefaultSurface('empty-project', 0)).toBe(false)
  expect(useAppStore.getState().tabsByWorktree['empty-project'] ?? []).toEqual([])
  expect(useAppStore.getState().unifiedTabsByWorktree['empty-project'] ?? []).toEqual([])
})
