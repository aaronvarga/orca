import { mergeWorktreeMetaForWrite } from '../loading-store/worktree-metadata/worktree-meta-write-normalization'
import { expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/orca-profiles/constants'
import type { Repo } from '../../../shared/repository/repo-types'
import { repointProjectFolder } from './repoint-project-folder'

const repo: Repo = {
  id: 'project',
  path: '/clients',
  displayName: 'Kelley Supply',
  kind: 'folder',
  addedAt: 1,
  badgeColor: 'gray'
}

it('repoints the root and folder instances while retaining settings, metadata and saved selections', () => {
  const state = getDefaultPersistedState('/home/test')
  const row = { ...repo }
  state.repos = [row]
  const root = 'project::/clients'
  const instance = `${root}::workspace:00000000-0000-4000-8000-000000000001`
  state.worktreeMeta[root] = mergeWorktreeMetaForWrite(undefined, { displayName: 'Main' })
  state.worktreeMeta[instance] = mergeWorktreeMetaForWrite(undefined, { displayName: 'Research' })
  state.workspaceSession.activeWorktreeId = instance
  state.workspaceSession.activeTabIdByWorktree = { [root]: 'chat', [instance]: 'notes' }
  const renamed = repointProjectFolder(state, row, '/clients/Kelley Supply')

  expect(row).toEqual({ ...repo, path: '/clients/Kelley Supply' })
  expect(renamed).toEqual([
    { oldWorktreeId: 'project::/clients', newWorktreeId: 'project::/clients/Kelley Supply' },
    {
      oldWorktreeId: instance,
      newWorktreeId:
        'project::/clients/Kelley Supply::workspace:00000000-0000-4000-8000-000000000001'
    }
  ])
  expect(state.worktreeMeta['project::/clients/Kelley Supply'].displayName).toBe('Main')
  expect(
    state.worktreeMeta[
      'project::/clients/Kelley Supply::workspace:00000000-0000-4000-8000-000000000001'
    ].displayName
  ).toBe('Research')
  expect(state.workspaceSession.activeWorktreeId).toBe(
    'project::/clients/Kelley Supply::workspace:00000000-0000-4000-8000-000000000001'
  )
  expect(state.workspaceSession.activeTabIdByWorktree).toEqual({
    'project::/clients/Kelley Supply': 'chat',
    'project::/clients/Kelley Supply::workspace:00000000-0000-4000-8000-000000000001': 'notes'
  })
})

it('refuses collisions before modifying the original project or workspace data', () => {
  const state = getDefaultPersistedState('/home/test')
  const row = { ...repo }
  state.repos = [row]
  state.worktreeMeta['project::/destination'] = mergeWorktreeMetaForWrite(undefined, {
    displayName: 'Existing'
  })
  state.worktreeMeta['project::/clients'] = mergeWorktreeMetaForWrite(undefined, {
    displayName: 'Original'
  })
  expect(() => repointProjectFolder(state, row, '/destination')).toThrow(
    'already has saved workspace state'
  )
  expect(row.path).toBe('/clients')
  expect(state.worktreeMeta['project::/clients'].displayName).toBe('Original')
  expect(state.worktreeMeta['project::/destination'].displayName).toBe('Existing')
})
