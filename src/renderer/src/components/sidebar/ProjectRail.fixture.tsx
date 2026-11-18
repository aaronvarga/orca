import { ConfirmationDialogProvider } from '../dismiss/confirmation/confirmation-dialog'
import { defineFixture } from '../../component-fixtures/component-fixture'
import ProjectRail from './ProjectRail'
import { RailButton } from './ProjectRailButton'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import type { ProjectRailStatus } from './project-rail-status'
import type { Repo } from '../../../../shared/repository/repo-types'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'

const repos: Repo[] = [
  {
    id: 'orca',
    displayName: 'Orca',
    path: '/projects/orca',
    badgeColor: '',
    addedAt: 1,
    repoIcon: { type: 'lucide', name: 'Code2' }
  },
  {
    id: 'loadmanager',
    displayName: 'LoadManager',
    path: '/projects/loadmanager',
    badgeColor: '',
    addedAt: 2,
    repoIcon: { type: 'lucide', name: 'Package' }
  },
  {
    id: 'folder',
    displayName: 'Notes',
    path: '/projects/notes',
    kind: 'folder',
    badgeColor: '',
    addedAt: 3,
    repoIcon: { type: 'lucide', name: 'Folder' }
  }
]
export const collapsed = defineFixture({
  width: 96,
  store: { repos, sidebarOpen: false, activeView: 'terminal' },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  )
})
export const settings = defineFixture({
  width: 96,
  store: { repos, sidebarOpen: true, activeView: 'settings' },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  )
})

export const dashboard = defineFixture({
  ...collapsed,
  width: 1000,
  render: () => (
    <div className="flex h-[600px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  ),
  setup: () =>
    useAppStore.setState((state) => ({
      settings: {
        ...getDefaultSettings('/home/fixture'),
        ...state.settings,
        experimentalAgentDashboardPopout: true,
        experimentalAgentDashboardMode: 'in-window'
      }
    }))
})

export const dashboardOpen = defineFixture({
  ...dashboard,
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('[aria-label="Agent Dashboard"]')?.click()
    const deadline = performance.now() + 3000
    while (
      !document.querySelector('[data-agent-dashboard-sheet]') &&
      performance.now() < deadline
    ) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    const state = useAppStore.getState()
    if (!state.agentDashboardDrawerOpen || state.sidebarOpen) {
      throw new Error('Opening the Agent Dashboard must preserve the collapsed project pane')
    }
    if (!document.querySelector('[data-agent-dashboard-sheet]')) {
      throw new Error('The dashboard must render alongside the collapsed rail')
    }
  }
})
export const unavailableMenu = defineFixture({
  width: 420,
  store: { repos, sidebarOpen: false, activeView: 'terminal' },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  ),
  interact: async (frame) => {
    const button = frame.querySelector<HTMLButtonElement>('[aria-label="Orca · local"]')
    button?.click()
  }
})

const folderGroup = {
  id: 'clients',
  name: 'Clients',
  parentPath: '/clients',
  parentGroupId: null,
  createdFrom: 'manual' as const,
  tabOrder: 0,
  rootProjectOrder: 3,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}
export const visibility = defineFixture({
  width: 440,
  store: {
    repos: [repos[0], { ...repos[1], hiddenAt: 1 }, repos[2]],
    projectGroups: [folderGroup],
    sidebarOpen: false
  },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  ),
  interact: (frame) => {
    frame
      .querySelector<HTMLButtonElement>('[aria-label="Project visibility"]')
      ?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
      )
  }
})
export const folderBrowser = defineFixture({
  width: 440,
  store: { repos, projectGroups: [folderGroup], sidebarOpen: false },
  setup: () => {
    window.api.fs.readDir = async () => [
      { name: 'Acme', isDirectory: true, isSymlink: false },
      { name: 'Tapestry', isDirectory: true, isSymlink: false }
    ]
  },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  ),
  interact: (frame) =>
    frame.querySelector<HTMLButtonElement>('[aria-label="Clients · local"]')?.click()
})

const indicatorStates: [string, ProjectRailStatus][] = [
  ['Idle', { count: 0, unread: false }],
  ['Sessions', { count: 3, unread: false }],
  ['Working', { count: 2, unread: false, state: 'working' }],
  ['Progress', { count: 1, unread: false, state: 'working', progress: 42 }],
  ['Waiting', { count: 4, unread: false, state: 'waiting' }],
  ['Unread', { count: 1, unread: true, state: 'done' }],
  ['Mixed', { count: 12, unread: true, state: 'blocked' }],
  ['Overflow', { count: 105, unread: true, state: 'working' }]
]
export const indicators = defineFixture({
  width: 220,
  render: () => (
    <div className="flex bg-worktree-sidebar text-sidebar-foreground">
      <div className="flex w-10 shrink-0 flex-col items-center gap-1 py-2">
        {indicatorStates.map(([label, status]) => (
          <RailButton key={label} label={label} status={status} onClick={() => {}}>
            <RepoIconGlyph
              repoIcon={{ type: 'lucide', name: 'Code2' }}
              className="size-6 text-xl"
              iconClassName="size-6"
            />
          </RailButton>
        ))}
      </div>
      <div className="flex flex-col gap-1 px-4 py-2 text-2xs text-muted-foreground">
        {indicatorStates.map(([label]) => (
          <span key={label} className="flex h-8 items-center">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
})

export const folderGroupMenu = defineFixture({
  width: 440,
  store: { repos, projectGroups: [folderGroup], sidebarOpen: false },
  render: () => (
    <div className="flex h-[768px]">
      <ConfirmationDialogProvider>
        <ProjectRail />
      </ConfirmationDialogProvider>
    </div>
  ),
  interact: (frame) => {
    frame
      .querySelector<HTMLButtonElement>('[aria-label="Clients · local"]')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
  }
})
