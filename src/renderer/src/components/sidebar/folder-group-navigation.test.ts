import { beforeEach, expect, it, vi } from 'vitest'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'
const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  browse: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
  chooser: vi.fn(),
  activate: vi.fn(() => ({ opened: { primaryTabId: null } }))
}))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/runtime/files/reads/runtime-server-directory-browser', () => ({
  browseRuntimeServerDirectory: mocks.browse
}))
vi.mock('@/runtime/files/reads/runtime-directory-read', () => ({
  readRuntimeDirectory: mocks.read
}))
vi.mock('@/lib/workspace/activation/workspace-session-chooser', () => ({
  showWorkspaceSessionChooser: mocks.chooser
}))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorkspaceWithOutcome: mocks.activate
}))
import { readFolderGroupDirectory, openFolderGroupDirectory } from './folder-group-navigation'
const group: ProjectGroup = {
  id: 'clients',
  name: 'Clients',
  parentPath: '/clients',
  executionHostId: 'runtime:box',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}
const folder: FolderWorkspace = {
  id: 'acme',
  projectGroupId: 'clients',
  name: 'Acme',
  folderPath: '/clients/Acme',
  executionHostId: 'runtime:box',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 0,
  createdAt: 1,
  updatedAt: 1
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getState.mockReturnValue({
    projectGroups: [group],
    folderWorkspaces: [],
    createFolderWorkspace: mocks.create
  })
})
it('browses folders on their owning server, excluding files and dot folders', async () => {
  mocks.browse.mockResolvedValue({
    entries: [
      { name: 'Acme', isDirectory: true, isSymlink: false },
      { name: '.private', isDirectory: true, isSymlink: false },
      { name: 'notes.txt', isDirectory: false, isSymlink: false }
    ]
  })
  expect((await readFolderGroupDirectory(group, '/clients')).map((entry) => entry.name)).toEqual([
    'Acme'
  ])
  expect(mocks.browse).toHaveBeenCalledWith('box', '/clients')
  expect(mocks.read).not.toHaveBeenCalled()
})
it('reopens an existing folder on the exact host without creating a workspace or a shell', async () => {
  mocks.getState().folderWorkspaces = [folder]
  await openFolderGroupDirectory(group, '/clients/Acme')
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.chooser).toHaveBeenCalledWith('folder:acme')
  expect(mocks.activate).toHaveBeenCalledWith('folder:acme', {
    executionHostId: 'runtime:box',
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
})
it('does not activate when the host refuses to open a new folder', async () => {
  mocks.create.mockResolvedValue(null)
  await expect(openFolderGroupDirectory(group, '/clients/Acme')).rejects.toThrow(
    'could not be opened'
  )
  expect(mocks.create).toHaveBeenCalledWith(
    {
      projectGroupId: 'clients',
      initialSurface: 'chooser',
      folderPath: '/clients/Acme',
      connectionId: undefined
    },
    { runtimeEnvironmentId: 'box' }
  )
  expect(mocks.activate).not.toHaveBeenCalled()
})
