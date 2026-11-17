import { ProjectRailSeparatorMenuItem } from './ProjectRailSeparatorMenuItem'
import { useTranslate } from '@/i18n/use-translate'
import { AgentStateDot, agentStateProgressLabel } from '@/components/AgentStateDot'
import { Badge } from '@/components/ui/badge'
import type { ProjectRailStatus } from './project-rail-status'
import { useState, useRef } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { Repo } from '../../../../shared/repository/repo-types'
import { activateRailProject } from './project-rail-activation'
import {
  RepoHeaderProjectActionsMenu,
  type RepoHeaderProjectActions
} from './worktree-list/rows/repo-header-project-actions'
export function RailButton({
  label,
  onClick,
  children,
  active = false,
  buttonRef,
  status
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  status?: ProjectRailStatus
  buttonRef?: React.Ref<HTMLButtonElement>
}) {
  const t = useTranslate()
  const accessibleLabel = [
    label,
    status?.count
      ? t('commandCenter.sessions', '{{count}} sessions', {
          count: status.count,
          defaultValue_one: '{{count}} session'
        })
      : null,
    status?.state ? agentStateProgressLabel(status.state, status.progress) : null,
    status?.unread ? t('commandCenter.unreadCompletion', 'Unread completion') : null
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          variant={active ? 'secondary' : 'ghost'}
          size="icon-sm"
          className="relative shrink-0"
          aria-label={accessibleLabel}
          aria-current={active ? 'page' : undefined}
          data-current={active || undefined}
          onClick={onClick}
        >
          {children}
          {status?.state ? (
            <span
              className="pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-worktree-sidebar"
              aria-hidden="true"
            >
              <AgentStateDot
                state={status.state}
                progress={status.progress}
                size="md"
                title={null}
              />
            </span>
          ) : null}
          {status?.unread ? (
            <span
              className="pointer-events-none absolute -left-0.5 top-0 size-2 rounded-full bg-ring ring-2 ring-worktree-sidebar"
              aria-hidden="true"
            />
          ) : null}
          {status && status.count > 0 ? (
            <Badge
              variant="sidebarCount"
              className="pointer-events-none absolute -bottom-1 -right-1"
              aria-hidden="true"
            >
              {status.count > 99 ? '99+' : status.count}
            </Badge>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        {accessibleLabel}
      </TooltipContent>
    </Tooltip>
  )
}

export function ProjectRailButton({
  repo,
  actions,
  status
}: {
  repo: Repo
  actions: RepoHeaderProjectActions
  status: ProjectRailStatus
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const active = useAppStore(
    (s) =>
      s.activeRepoId === repo.id &&
      s.activeWorkspaceExecutionHostId === getRepoExecutionHostId(repo) &&
      s.activeView === 'terminal'
  )
  const label = `${repo.displayName} · ${getRepoExecutionHostId(repo)}`
  return (
    <div
      className="group relative"
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <RailButton
        label={label}
        status={status}
        buttonRef={buttonRef}
        active={active}
        onClick={() => {
          const error = activateRailProject(repo)
          setReason(error)
          if (error) {
            setMenuOpen(true)
          }
        }}
      >
        <RepoIconGlyph
          repoIcon={repo.repoIcon}
          color={repo.badgeColor}
          className="size-5 shrink-0 text-lg"
          iconClassName="size-5"
        />
      </RailButton>
      <div className="pointer-events-none absolute inset-0">
        <RepoHeaderProjectActionsMenu
          repo={repo}
          label={repo.displayName}
          projectGroups={projectGroups}
          actions={actions}
          hideTrigger
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!document.querySelector('[role="dialog"]')) {
              buttonRef.current?.focus({ preventScroll: true })
            }
          }}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          reason={reason}
        >
          <ProjectRailSeparatorMenuItem
            rowKey={JSON.stringify([getRepoExecutionHostId(repo), repo.id])}
          />
        </RepoHeaderProjectActionsMenu>
      </div>
    </div>
  )
}
