import type { RepoIcon } from '../../../../shared/repository/appearance/repo-icon'
import type { NativeChatStructuredViewProps } from '@/components/native-chat/native-chat-view-types'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'
import { CommandCenterViewMenu } from './CommandCenterViewMenu'
import { TerminalTile } from './TerminalTile'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw, Grid2X2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { CommandCenterSession } from '@/lib/terminal-inventory/terminal-inventory-state'
import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import type { Repo } from '../../../../shared/repository/repo-types'
import {
  commandCenterColumns,
  orderCommandCenterSessions,
  moveCommandCenterSession
} from './command-center-layout'

import type { ProjectRailStatus } from '../sidebar/project-rail-status'

type CommandCenterTileProject = {
  activity?: ProjectRailStatus
  projectName?: string
  projectColor?: string | null
  projectIcon?: RepoIcon | null
  repo?: Repo
  hostLabel: string
  attention?: boolean
}

export type CommandCenterTerminalTile = CommandCenterSession &
  CommandCenterTileProject & { kind?: 'terminal' }
export type CommandCenterChatTile = CommandCenterTileProject & {
  kind: 'chat'
  id: string
  ownerId: ExecutionHostId
  repoId?: string
  available: boolean
  unavailableReason?: string
  title: string
  tab: Tab
  chat: NativeChatStructuredViewProps
}
export type CommandCenterTile = CommandCenterTerminalTile | CommandCenterChatTile

export function CommandCenterView({
  sessions,
  presentation,
  onChange,
  onBack,
  onRefresh,
  refreshing,
  onOpen,
  onEnd,
  renderTerminal,
  collapsed,
  onCollapse,
  error
}: {
  sessions: CommandCenterTile[]
  presentation: CommandCenterPresentation
  onChange: (value: CommandCenterPresentation) => void
  onBack: () => void
  onRefresh: () => void
  refreshing: boolean
  onOpen: (session: CommandCenterTile) => void
  onEnd: (session: CommandCenterTile) => void
  renderTerminal: (session: CommandCenterTile) => React.ReactNode
  collapsed: ReadonlySet<string>
  onCollapse: (id: string) => void
  error?: string | null
}) {
  const t = useTranslate()
  const viewport = useRef<HTMLDivElement>(null)
  const dragged = useRef<string | null>(null)
  const [size, setSize] = useState({ width: 960, height: 640 })
  const [showHidden, setShowHidden] = useState(false)
  useEffect(() => {
    const el = viewport.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const update = (patch: Partial<CommandCenterPresentation>) =>
    onChange({ ...presentation, ...patch })
  const ordered = orderCommandCenterSessions(sessions, presentation.order)
  const filtered = ordered.filter(
    (s) =>
      (presentation.project === 'all' || s.repoId === presentation.project) &&
      (presentation.host === 'all' || s.ownerId === presentation.host) &&
      (showHidden || !presentation.hidden.includes(s.id))
  )
  const ids = ordered.map((s) => s.id)
  const groups = new Map<string, CommandCenterTile[]>()
  for (const session of filtered) {
    const key = presentation.groupByProject
      ? JSON.stringify([session.ownerId, session.repoId])
      : 'all'
    const group = groups.get(key) ?? []
    group.push(session)
    groups.set(key, group)
  }
  const columns = commandCenterColumns(presentation, filtered.length, size.width)
  const layoutGroups: [string, CommandCenterTile[]][] =
    presentation.layout === 'auto-columns' ? [['all', [...groups.values()].flat()]] : [...groups]
  const rows =
    presentation.layout === 'auto-columns'
      ? 1
      : presentation.layout === 'manual'
        ? presentation.rows
        : Math.max(
            1,
            Math.min(
              [...groups.values()].reduce(
                (total, group) => total + Math.ceil(group.length / columns),
                0
              ),
              Math.floor((size.height + 12) / 232)
            )
          )
  const tileHeight = Math.max(220, Math.floor((size.height - (rows - 1) * 12) / rows))
  const hosts = [...new Map(sessions.map((s) => [s.ownerId, s.hostLabel])).entries()]
  const projects = [
    ...new Map(
      sessions.map((s) => [
        s.repoId ?? '',
        s.repo?.displayName ?? s.projectName ?? s.repoId ?? t('commandCenter.project', 'Project')
      ])
    ).entries()
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t('commandCenter.back', 'Back')}
        </Button>
        <h1 className="mr-auto text-sm font-semibold">
          {t('commandCenter.title', 'Command Center')}
        </h1>
        <CommandCenterViewMenu
          presentation={presentation}
          onChange={onChange}
          projects={projects}
          hosts={hosts}
          showHidden={showHidden}
          onShowHiddenChange={setShowHidden}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={t('commandCenter.refresh', 'Refresh sessions')}
            >
              <RefreshCw
                className={refreshing ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('commandCenter.refresh', 'Refresh sessions')}</TooltipContent>
        </Tooltip>
      </header>
      {error ? (
        <p role="alert" className="border-b border-border px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <div ref={viewport} className="scrollbar-sleek min-h-0 flex-1 overflow-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Grid2X2 className="size-6" />
            <p className="text-sm">{t('commandCenter.empty', 'No sessions match this view.')}</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              {t('commandCenter.refresh', 'Refresh sessions')}
            </Button>
          </div>
        ) : null}
        <div className="space-y-3">
          {layoutGroups.map(([key, group]) => {
            const buckets = Array.from({ length: columns }, (): CommandCenterTile[] => [])
            group.forEach((session, index) => buckets[index % buckets.length].push(session))
            const strips = buckets.map(
              (items) =>
                presentation.layout === 'auto-columns' &&
                items.length > 0 &&
                items.every((s) => collapsed.has(s.id))
            )
            return (
              <section
                key={key}
                className="min-w-0"
                aria-label={
                  presentation.groupByProject && presentation.layout !== 'auto-columns'
                    ? (group[0].repo?.displayName ?? group[0].projectName)
                    : undefined
                }
              >
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: buckets
                      .map((_, i) =>
                        strips[i]
                          ? '48px'
                          : presentation.layout === 'manual' ||
                              presentation.layout === 'auto-columns'
                            ? 'minmax(320px, 1fr)'
                            : 'minmax(0, 1fr)'
                      )
                      .join(' ')
                  }}
                >
                  {buckets.map((items, column) => (
                    <div key={column} className="flex min-w-0 flex-col gap-3">
                      {items.map((session) => (
                        <TerminalTile
                          key={session.id}
                          session={session}
                          collapsed={collapsed.has(session.id)}
                          onCollapse={() => onCollapse(session.id)}
                          onOpen={() => onOpen(session)}
                          onEnd={() => onEnd(session)}
                          hidden={presentation.hidden.includes(session.id)}
                          onHide={() =>
                            update({
                              hidden: presentation.hidden.includes(session.id)
                                ? presentation.hidden.filter((id) => id !== session.id)
                                : [...presentation.hidden, session.id]
                            })
                          }
                          onMove={(direction) => {
                            const index = ids.indexOf(session.id)
                            const target = ids[index + direction]
                            if (target) {
                              update({ order: moveCommandCenterSession(ids, session.id, target) })
                            }
                          }}
                          canMoveEarlier={ids.indexOf(session.id) > 0}
                          canMoveLater={ids.indexOf(session.id) < ids.length - 1}
                          renderTerminal={renderTerminal}
                          height={tileHeight}
                          strip={strips[column]}
                          onDragStart={() => {
                            dragged.current = session.id
                          }}
                          onDrop={() => {
                            if (dragged.current) {
                              update({
                                order: moveCommandCenterSession(ids, dragged.current, session.id)
                              })
                            }
                            dragged.current = null
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
