import { SettingsUpdateIcon, useSettingsUpdateAction } from './SettingsUpdateIcon'
import {
  selectWorktreesByRepo,
  selectFolderWorkspaces,
  selectDetectedWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { ProjectVisibilityMenu } from './ProjectVisibilityMenu'
import { toggleAgentDashboardFromShortcut } from '@/hooks/app-commands/agent-dashboard-command'
import { Fragment, Suspense } from 'react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { resolveLeftSidebarStyleVariables } from '@/app-shell/appearance/left-sidebar-appearance'
import { ProjectRailButton, RailButton } from './ProjectRailButton'
import { FolderGroupRailButton } from './FolderGroupRailButton'
import { getProjectRailStatus, type ProjectRailSession } from './project-rail-status'
import { useCommandCenterChatSessions } from '../command-center/use-command-center-chat-sessions'
import { useShallow } from 'zustand/react/shallow'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import {
  Activity,
  FolderPlus,
  MoreHorizontal,
  Search,
  Grid2X2,
  LayoutDashboard,
  HardDrive
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useRepoMap } from '@/store/repos/use-repository-catalog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useTerminalInventory } from '@/lib/terminal-inventory/use-terminal-inventory'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { getRepoOwnerWorktreeVisibilityDefaults } from '@/store/slices/worktrees/listing/worktree-visibility-defaults-by-host'
import { useProjectRailRows } from './use-project-rail-rows'
import { PROJECT_RAIL_WIDTH } from './sidebar-geometry'
import type { RepoHeaderProjectActions } from './worktree-list/rows/repo-header-project-actions'
import { openHeaderCreateComposer } from './worktree-list/rows/header-create-workspace-target'
import { useProjectGroupDialogs } from './worktree-list/rows/use-project-group-dialogs'
import { SidebarWorktreeListDialogs } from './worktree-list/rows/ProjectGroupDialogs'
import { AddProjectMenu } from './project-admission/menu/AddProjectMenu'

const AgentDashboardSidebarHost = lazyWithRetry(
  () => import('../dashboard/sidebar/AgentDashboardSidebarHost')
)

export default function ProjectRail({ reserveTitlebar = false }: { reserveTitlebar?: boolean }) {
  const t = useTranslate()
  const settingsUpdate = useSettingsUpdateAction()
  const rows = useProjectRailRows()
  const separators = useAppStore((s) => s.projectRailSeparators) ?? []
  const activeView = useAppStore((s) => s.activeView)
  const { sessions } = useTerminalInventory()
  const statusState = useAppStore(
    useShallow((s) => ({
      unreadAgentCompletionPanes: s.unreadAgentCompletionPanes,
      terminalLayoutsByTabId: s.terminalLayoutsByTabId,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      agentStatusEpoch: s.agentStatusEpoch,
      unifiedTabsByWorktree: s.unifiedTabsByWorktree,
      worktreesByRepo: selectWorktreesByRepo(s),
      detectedWorktreesByRepo: selectDetectedWorktreesByRepo(s),
      folderWorkspaces: selectFolderWorkspaces(s)
    }))
  )
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const settings = useAppStore((s) => s.settings)
  const dashboardOpen = useAppStore((s) => s.agentDashboardDrawerOpen)
  const statusBarVisible = useAppStore((s) => s.statusBarVisible)
  const defaults = useAppStore((s) => s.worktreeVisibilityDefaultsByHost)
  const repoMap = useRepoMap()
  const dialogs = useProjectGroupDialogs({ repos, repoMap, projectGroups })
  const state = useAppStore(
    useShallow((s) => ({
      openSettingsTarget: s.openSettingsTarget,
      openSettingsPage: s.openSettingsPage,
      openModal: s.openModal,
      openCommandCenter: s.openCommandCenter,
      openActivityPage: s.openActivityPage,
      openSpacePage: s.openSpacePage,
      openAutomationsPage: s.openAutomationsPage,
      openSkillsPage: s.openSkillsPage,
      openMobilePage: s.openMobilePage
    }))
  )
  const chats = useCommandCenterChatSessions()
  const allSessions: ProjectRailSession[] = [...sessions, ...chats]
  const actions: RepoHeaderProjectActions = {
    getWorktreeVisibilityDefaults: (repo) =>
      getRepoOwnerWorktreeVisibilityDefaults(repo, settings, defaults),
    onOpenRepoSettings: (repoId, sectionId) => {
      state.openSettingsTarget({ pane: 'repo', repoId, ...(sectionId ? { sectionId } : {}) })
      state.openSettingsPage()
    },
    onOpenWorktreeVisibility: (repo) =>
      state.openModal('worktree-visibility', {
        repoId: repo.id,
        hostId: getRepoExecutionHostId(repo)
      }),
    onCreateGroupFromRepo: dialogs.handleCreateGroupFromRepo,
    onMoveProjectToGroup: dialogs.handleMoveProjectToGroup,
    onRemoveProjectFromGroup: dialogs.handleRemoveProjectFromGroup,
    onRemoveProject: (repo) =>
      state.openModal('confirm-remove-folder', {
        repoId: repo.id,
        displayName: repo.displayName,
        hostId: getRepoExecutionHostId(repo)
      }),
    onCreateForRepo: openHeaderCreateComposer
  }
  return (
    <>
      {settings?.experimentalAgentDashboardPopout === true && dashboardOpen ? (
        <Suspense fallback={null}>
          <AgentDashboardSidebarHost
            workspaceBoardOpen={false}
            closeWorkspaceBoard={() => {}}
            statusBarVisible={statusBarVisible}
            leftSidebarStyle={resolveLeftSidebarStyleVariables(settings)}
          />
        </Suspense>
      ) : null}
      <nav
        aria-label={t('commandCenter.projects', 'Projects')}
        className="flex min-h-0 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-worktree-sidebar text-sidebar-foreground"
        style={{ width: PROJECT_RAIL_WIDTH, paddingTop: reserveTitlebar ? 36 : 8 }}
      >
        <RailButton
          label={t('commandCenter.title', 'Command Center')}
          active={activeView === 'command-center'}
          onClick={state.openCommandCenter}
        >
          <Grid2X2 className="size-4" />
        </RailButton>
        {settings?.experimentalAgentDashboardPopout === true ? (
          <RailButton
            label={t('dashboard.sidebar.dashboardLabel', 'Agent Dashboard')}
            active={dashboardOpen}
            disabled={activeView === 'settings'}
            onClick={() =>
              toggleAgentDashboardFromShortcut(useAppStore.getState(), () => {
                void window.api.dashboard.openPopout()
              })
            }
          >
            <LayoutDashboard className="size-4" />
          </RailButton>
        ) : null}
        <RailButton
          label={t('commandCenter.search', 'Search')}
          onClick={() => state.openModal('worktree-palette')}
        >
          <Search className="size-4" />
        </RailButton>
        <div className="scrollbar-sleek min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto py-1">
          <div
            className="flex flex-col items-center gap-1"
            style={{ width: PROJECT_RAIL_WIDTH - 1 }}
          >
            {rows.map((row) => {
              const ownerId = getRepoExecutionHostId(
                row.kind === 'repo' ? row.repo : row.projectGroup
              )
              const repoId =
                row.kind === 'repo' ? row.repo.id : folderWorkspaceRepoId(row.projectGroup.id)
              const projectSessions = allSessions.filter(
                (session) =>
                  session.available &&
                  (session.kind === 'chat' ? session.ownerId : session.projectOwnerId) ===
                    ownerId &&
                  session.repoId === repoId
              )
              const status = getProjectRailStatus(projectSessions, statusState)
              return (
                <Fragment key={row.key}>
                  {separators.includes(row.key) ? (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      className="my-1 w-8 border-t border-sidebar-border"
                    />
                  ) : null}
                  {row.kind === 'repo' ? (
                    <ProjectRailButton repo={row.repo} actions={actions} status={status} />
                  ) : (
                    <FolderGroupRailButton
                      projectGroup={row.projectGroup}
                      dialogs={dialogs}
                      status={status}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 border-t border-sidebar-border py-2">
          <ProjectVisibilityMenu />
          <AddProjectMenu
            side="right"
            onOpenEntryRequest={(entryRequest) => state.openModal('add-repo', { entryRequest })}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={t('commandCenter.addProject', 'Add project')}
            >
              <FolderPlus className="size-4" />
            </Button>
          </AddProjectMenu>
          <RailButton
            label={settingsUpdate.label}
            active={activeView === 'settings'}
            onClick={settingsUpdate.open}
          >
            <SettingsUpdateIcon available={settingsUpdate.available} />
          </RailButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={t('commandCenter.more', 'More navigation')}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right">
              <DropdownMenuItem onSelect={state.openActivityPage}>
                <Activity className="size-4" />
                {t('commandCenter.activity', 'Activity')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={state.openSpacePage}>
                <HardDrive className="size-4" />
                {t('commandCenter.space', 'Space')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={state.openAutomationsPage}>
                {t('commandCenter.automations', 'Automations')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={state.openSkillsPage}>
                {t('commandCenter.skills', 'Skills')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={state.openMobilePage}>
                {t('commandCenter.mobile', 'Mobile')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      <SidebarWorktreeListDialogs
        dialogs={dialogs}
        repos={repos}
        settings={settings}
        suppressExternalWorktreeInboxRepoId={null}
        setSuppressExternalWorktreeInboxRepoId={() => {}}
        newExternalWorktreeInboxActionState={new Map()}
        onConfirmSuppressExternalWorktreeInbox={() => {}}
        onOpenWorktreeVisibility={actions.onOpenWorktreeVisibility}
      />
    </>
  )
}
