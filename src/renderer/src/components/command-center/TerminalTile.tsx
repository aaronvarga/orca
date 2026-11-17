import { cn } from '@/lib/class-names'
import { AgentStateDot } from '@/components/AgentStateDot'
import { normalizeRepoBadgeColor } from '../../../../shared/repository/appearance/repo-badge-color'
import { FolderPathButton } from '@/components/file-actions/FolderPathButton'
import { useAppStore } from '@/store'
import { parseExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { useTranslate } from '@/i18n/use-translate'
import type { CommandCenterTile } from './CommandCenterView'

export function TerminalTile({
  session,
  collapsed,
  onCollapse,
  onOpen,
  onEnd,
  onHide,
  hidden,
  onMove,
  canMoveEarlier,
  canMoveLater,
  renderTerminal,
  height,
  strip,
  onDragStart,
  onDrop
}: {
  session: CommandCenterTile
  collapsed: boolean
  onCollapse: () => void
  onOpen: () => void
  onEnd: () => void
  onHide: () => void
  hidden: boolean
  onMove: (direction: -1 | 1) => void
  canMoveEarlier: boolean
  canMoveLater: boolean
  renderTerminal: (session: CommandCenterTile) => React.ReactNode
  height: number
  strip: boolean
  onDragStart: () => void
  onDrop: () => void
}) {
  const t = useTranslate()
  const activity = session.available ? session.activity : undefined
  const state = activity?.state
  const working = state === 'working'
  const needsInput = state === 'permission' || state === 'waiting' || state === 'blocked'
  const failed = state === 'failed'
  const unread = session.available && (activity?.unread || session.attention)
  const attentionLabel = needsInput
    ? t('commandCenter.needsInput', 'Needs input')
    : unread
      ? t('commandCenter.unreadUpdate', 'Unread update')
      : null
  const progressBar =
    working || needsInput || failed ? (
      <div
        aria-hidden="true"
        data-pane-activity={working ? 'working' : failed ? 'failed' : 'paused'}
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 z-10',
          working ? 'command-center-working-strip h-1' : 'h-0.5',
          needsInput && 'bg-status-warning',
          failed && 'bg-destructive'
        )}
      />
    ) : null
  const projectColor =
    normalizeRepoBadgeColor(session.repo?.badgeColor) ??
    normalizeRepoBadgeColor(session.projectColor)
  const workspace = useAppStore((state) =>
    session.kind === 'chat'
      ? state.getKnownWorktreeById(session.tab.worktreeId, session.ownerId)
      : null
  )
  const folderPath =
    session.kind === 'chat'
      ? (workspace?.path ?? session.repo?.path)
      : session.terminal.worktreePath
  const folderOwner =
    session.kind === 'chat'
      ? session.ownerId
      : (session.projectOwnerId ?? parseExecutionHostId(session.ownerId)?.id ?? 'unresolved')
  const folderButton = folderPath ? (
    <FolderPathButton path={folderPath} owner={folderOwner} />
  ) : null
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [])
  const title =
    session.kind === 'chat'
      ? session.title
      : (session.terminal.paneTitle ??
        session.terminal.title ??
        t('commandCenter.terminal', 'Terminal'))
  return (
    <section
      ref={ref}
      aria-label={`${session.repo?.displayName ?? session.projectName ?? session.repoId} · ${title}`}
      className={cn(
        'relative flex min-w-0 shrink-0 flex-col overflow-hidden rounded-md border bg-card text-card-foreground focus-within:border-ring focus-within:ring-1 focus-within:ring-ring',
        failed ? 'border-destructive' : attentionLabel ? 'border-status-warning' : 'border-border'
      )}
      style={{ height: strip ? height : collapsed ? 40 : height }}
    >
      <header
        draggable
        style={
          projectColor
            ? {
                backgroundColor: `color-mix(in srgb, ${projectColor} 25%, var(--card))`,
                borderBottomColor: projectColor
              }
            : undefined
        }
        className="relative flex h-10 shrink-0 items-center gap-1 border-b border-border px-1"
        onDragStart={onDragStart}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onDrop()
        }}
      >
        {collapsed || strip ? progressBar : null}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            collapsed
              ? t('commandCenter.expand', 'Expand terminal')
              : t('commandCenter.collapse', 'Collapse terminal')
          }
          aria-expanded={!collapsed}
          onClick={onCollapse}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
        {!strip ? (
          <>
            <RepoIconGlyph
              repoIcon={session.repo?.repoIcon ?? session.projectIcon}
              color={projectColor ?? undefined}
              className="size-5 shrink-0"
              iconClassName="size-5"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">
                {session.repo?.displayName ?? session.projectName ?? session.repoId}
              </div>
              <div className="truncate text-2xs text-muted-foreground">{title}</div>
            </div>
            {attentionLabel ? (
              <span className="shrink-0 rounded-sm bg-status-warning-background px-1.5 py-0.5 text-2xs text-status-warning-text">
                {attentionLabel}
              </span>
            ) : state && state !== 'idle' ? (
              <AgentStateDot state={state} progress={activity?.progress} />
            ) : null}
            <span
              className="max-w-24 truncate text-2xs text-muted-foreground"
              style={projectColor ? { color: 'inherit' } : undefined}
            >
              {session.hostLabel}
            </span>
            {folderButton}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('commandCenter.sessionActions', 'Session actions')}
                >
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onOpen} disabled={!session.available}>
                  {t('commandCenter.openInProject', 'Open in Project')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(-1)} disabled={!canMoveEarlier}>
                  {t('commandCenter.moveEarlier', 'Move Earlier')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(1)} disabled={!canMoveLater}>
                  {t('commandCenter.moveLater', 'Move Later')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onHide}>
                  {hidden
                    ? t('commandCenter.showSession', 'Show Session')
                    : t('commandCenter.hide', 'Hide Session')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onEnd}
                  disabled={!session.available}
                >
                  {session.kind === 'chat'
                    ? t('commandCenter.closeChat', 'Close Chat')
                    : t('commandCenter.end', 'End Session')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </header>
      {strip ? (
        <div className="flex flex-col items-center gap-2 py-1">
          {state ? (
            <AgentStateDot state={state} progress={activity?.progress} unread={unread} />
          ) : null}
          {folderButton}
        </div>
      ) : null}
      {strip ? (
        <button
          className="min-h-0 flex-1 overflow-hidden p-2 text-xs [writing-mode:vertical-rl]"
          onClick={onCollapse}
        >
          {session.repo?.displayName ?? session.projectName} · {title}
        </button>
      ) : !collapsed ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {progressBar}
          {session.available ? (
            visible ? (
              renderTerminal(session)
            ) : (
              <div className="min-h-0 flex-1" />
            )
          ) : (
            <div role="status" className="p-3 text-xs text-muted-foreground">
              {session.unavailableReason}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
