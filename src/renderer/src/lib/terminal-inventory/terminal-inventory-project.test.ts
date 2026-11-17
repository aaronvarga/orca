import { expect, it } from 'vitest'
import { terminalInventoryProject } from './terminal-inventory-project'
import type { CommandCenterSession } from './terminal-inventory-state'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'

const session: CommandCenterSession = {
  id: 'session',
  ownerId: 'runtime:server',
  route: { target: { kind: 'environment', environmentId: 'server' }, at: 'local' },
  previewPtyId: 'remote:server@@handle',
  available: true,
  terminal: {
    handle: 'handle',
    ptyId: 'pty',
    incarnationId: 'first',
    worktreeId: 'repo::/repo',
    worktreePath: '/repo',
    branch: 'main',
    tabId: 'tab',
    leafId: 'leaf',
    title: null,
    connected: true,
    writable: true,
    lastOutputAt: null,
    preview: '',
    executionHostId: 'local',
    verdict: 'live'
  }
}
const state: Parameters<typeof terminalInventoryProject>[0] = {
  repos: [
    { id: 'repo', path: '/repo', displayName: 'Local', badgeColor: '', addedAt: 0 },
    {
      id: 'repo',
      path: '/repo',
      displayName: 'Remote',
      badgeColor: '',
      addedAt: 0,
      executionHostId: 'runtime:server'
    }
  ],
  projectGroups: [],
  folderWorkspaces: [],
  worktreesByRepo: {},
  visibleWorkspaceHostIds: null,
  workspaceHostScope: 'all'
}

it('never matches endpoint-local remote sessions to a colliding local project', () => {
  expect(terminalInventoryProject(state, session)).toEqual({
    repoId: 'repo',
    projectOwnerId: 'runtime:server'
  })
  expect(terminalInventoryProject({ ...state, repos: [state.repos[0]!] }, session)).toBeNull()
  expect(
    terminalInventoryProject({ ...state, visibleWorkspaceHostIds: ['local'] }, session)
  ).toBeNull()
})

it('includes folder workspace groups without requiring a repository row', () => {
  const project = terminalInventoryProject(
    {
      ...state,
      repos: [],
      projectGroups: [
        {
          id: 'group',
          name: 'Folders',
          parentPath: '/folders',
          parentGroupId: null,
          createdFrom: 'manual',
          tabOrder: 0,
          isCollapsed: true,
          color: null,
          createdAt: 0,
          updatedAt: 0,
          executionHostId: 'runtime:server'
        }
      ],
      folderWorkspaces: [
        {
          id: 'folder-session',
          projectGroupId: 'group',
          name: 'Folder',
          folderPath: '/folders',
          executionHostId: 'runtime:server',
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
      ]
    },
    { ...session, terminal: { ...session.terminal, worktreeId: 'folder:folder-session' } }
  )
  expect(project).toEqual({
    repoId: 'folder-workspace:group',
    projectOwnerId: 'runtime:server',
    projectGroupId: 'group'
  })
})

it('requires exact nested SSH catalog ownership before matching a paired project', () => {
  const nested: CommandCenterSession = {
    ...session,
    ownerId: 'nested:server/target',
    route: { target: { kind: 'environment', environmentId: 'server' }, at: 'ssh:target' }
  }
  expect(terminalInventoryProject(state, nested)).toBeNull()
  expect(
    terminalInventoryProject(
      {
        ...state,
        worktreesByRepo: {
          repo: [
            makeWorktree({
              id: 'repo::/repo',
              repoId: 'repo',
              hostId: 'ssh:target',
              runtimeOwnerEnvironmentId: 'server'
            })
          ]
        }
      },
      nested
    )
  ).toEqual({ repoId: 'repo', projectOwnerId: 'runtime:server' })
})
