import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import { FolderOpen, Plus, Grid2X2 } from 'lucide-react'
import { ProjectRailSeparatorMenuItem } from './ProjectRailSeparatorMenuItem'
import { FolderGroupBrowser } from './FolderGroupBrowser'
import { Popover, PopoverAnchor } from '@/components/ui/popover'
import { openNewTerminalTabInWorkspace } from '@/store/terminals/tabs/creation/terminal-active-workspace-creation'
import { openProjectCommandCenter } from '@/components/command-center/command-center-navigation'
import { useState, useRef } from 'react'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { useAppStore } from '@/store'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { activateRailProject } from './project-rail-activation'
import { RailButton } from './ProjectRailButton'
import type { ProjectRailStatus } from './project-rail-status'
import { ProjectGroupHeaderMenu } from './worktree-list/rows/project-group-header-actions'
import type { useProjectGroupDialogs } from './worktree-list/rows/use-project-group-dialogs'

export function FolderGroupRailButton({
  projectGroup,
  dialogs,
  status
}: {
  projectGroup: ProjectGroup
  dialogs: ReturnType<typeof useProjectGroupDialogs>
  status: ProjectRailStatus
}) {
  const t = useTranslate()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const hostId = getRepoExecutionHostId(projectGroup)
  const active = useAppStore(
    (state) =>
      state.activeView === 'terminal' &&
      state.activeWorkspaceExecutionHostId === hostId &&
      selectFolderWorkspaces(state).some(
        (folder) =>
          folder.projectGroupId === projectGroup.id &&
          folderWorkspaceKey(folder.id) === state.activeWorktreeId
      )
  )
  const activate = (currentCheckout = false): void => {
    const error = activateRailProject(projectGroup, currentCheckout)
    setReason(error)
    if (error) {
      setOpen(true)
    }
  }
  return (
    <Popover open={browserOpen} onOpenChange={setBrowserOpen}>
      <PopoverAnchor asChild>
        <div
          className="group relative"
          onContextMenu={(event) => {
            event.preventDefault()
            setBrowserOpen(false)
            setOpen(true)
          }}
        >
          <RailButton
            buttonRef={buttonRef}
            label={`${projectGroup.name} · ${hostId}`}
            active={active}
            status={status}
            onClick={() => setBrowserOpen(true)}
          >
            <RepoIconGlyph
              repoIcon={projectGroup.repoIcon}
              color={projectGroup.color ?? undefined}
              className="size-6 shrink-0 text-xl"
              iconClassName="size-6"
            />
          </RailButton>
          <div className="pointer-events-none absolute inset-0">
            <ProjectGroupHeaderMenu
              groupId={projectGroup.id}
              hostId={hostId}
              label={projectGroup.name}
              projectGroup={projectGroup}
              onRename={dialogs.handleRenameProjectGroup}
              onDelete={dialogs.handleDeleteProjectGroup}
              onRefreshProjectGroup={dialogs.handleRefreshProjectGroup}
              hideTrigger
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                if (!document.querySelector('[role="dialog"]')) {
                  buttonRef.current?.focus({ preventScroll: true })
                }
              }}
              open={open}
              onOpenChange={setOpen}
              reason={reason}
            >
              <ProjectRailSeparatorMenuItem
                rowKey={JSON.stringify(['folder-group', hostId, projectGroup.id])}
              />
              <DropdownMenuItem onSelect={() => activate(true)}>
                <FolderOpen className="size-4" />
                {t('commandCenter.openCheckout', 'Open current checkout')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const error = activateRailProject(projectGroup, false, true)
                  setReason(error)
                  if (error) {
                    setOpen(true)
                    return
                  }
                  const worktreeId = useAppStore.getState().activeWorktreeId
                  if (worktreeId) {
                    void openNewTerminalTabInWorkspace(useAppStore.getState, worktreeId).catch(
                      (error: unknown) => {
                        setReason(error instanceof Error ? error.message : String(error))
                        setOpen(true)
                      }
                    )
                  }
                }}
              >
                <Plus className="size-4" />
                {t('commandCenter.newSession', 'New session')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openProjectCommandCenter(projectGroup)}>
                <Grid2X2 className="size-4" />
                {t('commandCenter.openProject', 'Open Project Command Center')}
              </DropdownMenuItem>
            </ProjectGroupHeaderMenu>
          </div>
        </div>
      </PopoverAnchor>
      {browserOpen ? (
        <FolderGroupBrowser group={projectGroup} onOpened={() => setBrowserOpen(false)} />
      ) : null}
    </Popover>
  )
}
