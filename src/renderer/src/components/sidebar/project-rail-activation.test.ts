import type { Repo } from '../../../../shared/repository/repo-types'
import { beforeEach, expect, it, vi } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  activate: vi.fn(() => ({ opened: { primaryTabId: null } })),
  chooser: vi.fn(),
  hosts: vi.fn(() => [{ id: 'ssh:box', health: 'available' }])
}))
vi.mock('@/lib/workspace/activation/workspace-session-chooser', () => ({
  showWorkspaceSessionChooser: mocks.chooser
}))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorkspaceWithOutcome: mocks.activate
}))
vi.mock('@/lib/workspace/ownership/worktree-operation-route', () => ({
  resolveWorktreeOperationRouteResultForHost: vi.fn(() => ({
    kind: 'resolved',
    route: { executionHostId: 'ssh:box', runtimeEnvironmentId: null }
  }))
}))
vi.mock('../../../../shared/execution-host/execution-host-registry', () => ({
  buildExecutionHostRegistry: mocks.hosts
}))
import { activateRailProject } from './project-rail-activation'

const repo: Repo = {
  id: 'repo',
  path: '/linked',
  displayName: 'Repo',
  badgeColor: '',
  addedAt: 0,
  executionHostId: 'ssh:box'
}
const primary = makeWorktree({
  id: 'repo::/repo',
  repoId: 'repo',
  path: '/repo',
  branch: 'main',
  isMainWorktree: true,
  hostId: 'ssh:box'
})
const linked = makeWorktree({
  id: 'repo::/linked',
  repoId: 'repo',
  path: '/linked',
  branch: 'feature',
  hostId: 'ssh:box'
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hosts.mockReturnValue([{ id: 'ssh:box', health: 'available' }])
  mocks.getState.mockReturnValue({
    repos: [repo],
    projectGroups: [],
    worktreesByRepo: { repo: [primary, linked] },
    folderWorkspaces: [],
    lastVisitedAtByWorktreeId: {}
  })
})

it('opens the exact linked checkout without falling back to the primary directory', () => {
  expect(activateRailProject(repo)).toBeNull()
  expect(mocks.activate).toHaveBeenCalledWith('repo::/linked', {
    executionHostId: 'ssh:box',
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
  expect(primary.branch).toBe('main')
  expect(linked.branch).toBe('feature')
})

it('restores only the most recently visited workspace on the project owner', () => {
  const state = mocks.getState()
  state.worktreesByRepo.repo.push(
    makeWorktree({ id: 'repo::/other', repoId: 'repo', path: '/other', hostId: 'local' })
  )
  state.lastVisitedAtByWorktreeId = { 'ssh:box|repo::/repo': 10, 'local|repo::/other': 100 }
  expect(activateRailProject(repo)).toBeNull()
  expect(mocks.activate).toHaveBeenCalledWith('repo::/repo', {
    executionHostId: 'ssh:box',
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
})

it('keeps an unavailable host in its menu instead of activating stale catalog data', () => {
  mocks.hosts.mockReturnValue([{ id: 'ssh:box', health: 'disconnected' }])
  expect(activateRailProject(repo)).toContain('host is unavailable')
  expect(mocks.activate).not.toHaveBeenCalled()
})

it('opens an existing folder workspace on its exact group owner', () => {
  const group: ProjectGroup = {
    id: 'group',
    name: 'Folder',
    parentPath: '/folder',
    executionHostId: 'ssh:box',
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: true,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
  const folder: FolderWorkspace = {
    id: 'folder',
    projectGroupId: 'group',
    name: 'Folder workspace',
    folderPath: '/folder',
    executionHostId: 'ssh:box',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
  mocks.getState.mockReturnValue({
    repos: [],
    projectGroups: [group],
    worktreesByRepo: {},
    folderWorkspaces: [folder],
    lastVisitedAtByWorktreeId: {}
  })
  expect(activateRailProject(group)).toBeNull()
  expect(mocks.activate).toHaveBeenCalledWith('folder:folder', {
    executionHostId: 'ssh:box',
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
})
