import { createContext, useContext, useMemo } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { AgentChildRowContent } from '@/components/agent/status/AgentChildRowContent'
import { agentChildRowName } from '@/components/agent/status/agent-child-row-text'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useNow } from '@/lib/window-activity/use-now'
import { useTranslate } from '@/i18n/use-translate'
import type { AgentChildRowModel } from '../../../../../shared/agent-status/presentation/agent-child-row-model'
import { flattenAgentChildRowModels } from '../../../../../shared/agent-status/presentation/agent-child-row-model'
import { nativeChatAgentRows } from '../../../../../shared/native-chat/transcript/subagents/native-chat-agent-rows'
import {
  backgroundTaskRowMeta,
  backgroundTaskKindLabel
} from '../../../../../shared/agent-status/presentation/background-tasks/background-task-roster'
import type { StructuredSessionBackgroundTasksView } from '../../../../../shared/agent-session/view/structured-session-background-tasks-view'
import type { StructuredAgentSubagentRoster } from '../../../../../shared/agent-session/view/structured-agent-session-subagent-roster'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { useNativeChatMilestoneVisibility } from '../tools/tasks/NativeChatMilestoneVisibility'
import { KIND_ICONS } from '../tools/tasks/NativeChatBackgroundTasksStatus'
import { sayBackgroundTaskTranslated } from '../tools/tasks/background-task-words-text'
import { useStructuredSessionChildRowContext } from '../tools/tasks/use-structured-session-child-row-context'

export const NativeChatAgentVisualizerContext = createContext<{
  rows: AgentChildRowModel[]
  incomplete: boolean
  open: (id: string) => void
} | null>(null)

const NO_ROWS: AgentChildRowModel[] = []

export function NativeChatAgentVisualizerProvider(props: {
  paneKey: string
  roster?: StructuredAgentSubagentRoster
  backgroundTasks?: StructuredSessionBackgroundTasksView
  items?: readonly AgentJournalRenderItem[]
  open: (id: string) => void
  children: React.ReactNode
}) {
  const active = useNativeChatMilestoneVisibility()?.shown !== false
  const context = useStructuredSessionChildRowContext(props.paneKey, active)
  const rows = useMemo(() => {
    if (!active) {
      return NO_ROWS
    }
    const parents = new Map<string, string>()
    for (const item of props.items ?? []) {
      if (item.agentId && item.parentAgentId) {
        parents.set(item.agentId, item.parentAgentId)
      }
    }
    return nativeChatAgentRows(
      [...(props.roster?.values() ?? [])].map(({ entry }) => entry),
      props.backgroundTasks?.children ?? [],
      context ?? {
        parentEvidenceFresh: false,
        transportObservation: 'unverifiable',
        parentObservedAt: 0,
        hostClockOffsetMs: 0
      },
      parents
    )
  }, [active, context, props.roster, props.backgroundTasks?.children, props.items])
  const incomplete = props.backgroundTasks?.incomplete ?? false
  const value = useMemo(
    () => ({ rows, incomplete, open: props.open }),
    [rows, incomplete, props.open]
  )
  return (
    <NativeChatAgentVisualizerContext value={value}>
      {props.children}
    </NativeChatAgentVisualizerContext>
  )
}

export function NativeChatAgentVisualizer() {
  const t = useTranslate()
  const value = useContext(NativeChatAgentVisualizerContext)
  const rows = value?.rows ?? []
  const flat = flattenAgentChildRowModels(rows)
  const now = useNow(
    1_000,
    flat.some((row) => !row.settled && row.displayState !== 'unverifiable')
  )
  const starts = flat.map((row) => row.firstObservedAt).filter((at) => at > 0)
  const start = starts.length ? Math.min(...starts) : now
  const end = Math.max(start + 1, ...flat.map((row) => row.settledAt ?? row.observedAt ?? start))
  const agents = flat.filter((row) => row.kind === 'agent')
  return (
    <div className="space-y-2 text-xs">
      <p className="px-1 text-muted-foreground">
        {agents.length
          ? t('components.native-chat.agents.summary', '{{count}} agents · {{active}} active', {
              count: agents.length,
              active: agents.filter(
                (row) => !row.settled && ['working', 'monitoring'].includes(row.displayState)
              ).length
            })
          : rows.length
            ? t(
                'components.native-chat.agents.backgroundOnly',
                '{{count}} background tasks · no subagents',
                { count: flat.length, defaultValue_one: '{{count}} background task · no subagents' }
              )
            : t(
                'components.native-chat.agents.empty',
                'No subagents recorded in this conversation.'
              )}
      </p>
      {rows.length ? (
        <p className="px-1 text-2xs text-muted-foreground">
          {t(
            'components.native-chat.agents.timeline',
            'Bars show observed activity on the same time scale.'
          )}
        </p>
      ) : null}
      {[true, false].map((agentGroup) => {
        const grouped = rows.filter((row) => (row.kind === 'agent') === agentGroup)
        return grouped.length ? (
          <div key={String(agentGroup)} className="space-y-1">
            {!agentGroup ? (
              <h3 className="px-1 text-xs font-medium text-muted-foreground">
                {t('components.native-chat.agents.background', 'Background work')}
              </h3>
            ) : null}
            <ul className="divide-y divide-border">
              {grouped.map((row) => (
                <AgentRow
                  key={row.id}
                  row={row}
                  now={now}
                  start={start}
                  end={end}
                  open={value?.open}
                />
              ))}
            </ul>
          </div>
        ) : null
      })}
      {value?.incomplete ? (
        <p className="px-1 text-muted-foreground">
          {t(
            'components.native-chat.agents.incomplete',
            'Some activity is unavailable from this host.'
          )}
        </p>
      ) : null}
    </div>
  )
}

function AgentRow({
  row,
  now,
  start,
  end,
  open
}: {
  row: AgentChildRowModel
  now: number
  start: number
  end: number
  open?: (id: string) => void
}) {
  const t = useTranslate()
  const Icon = KIND_ICONS[row.kind]
  const knownTime = row.firstObservedAt > 0
  const offset = knownTime ? Math.max(0, ((row.firstObservedAt - start) / (end - start)) * 100) : 0
  const width = knownTime
    ? Math.max(
        1,
        (((row.settledAt ?? row.observedAt ?? row.firstObservedAt) - row.firstObservedAt) /
          (end - start)) *
          100
      )
    : 0
  return (
    <li className="min-w-0 py-1">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full min-w-0 items-center gap-1.5 rounded-md p-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <AgentChildRowContent
              row={row}
              now={now}
              leadClassName="font-medium text-foreground"
              trailClassName="text-muted-foreground"
              separator=" · "
            />
            <ChevronRight
              aria-hidden
              className="size-3 shrink-0 group-data-[state=open]:rotate-90"
            />
          </button>
        </CollapsibleTrigger>
        <div className="px-1 pb-1 text-2xs font-mono tabular-nums text-muted-foreground">
          {backgroundTaskRowMeta(
            row,
            row.displayState === 'unverifiable' ? (row.observedAt ?? row.firstObservedAt) : now
          )}
        </div>
        {knownTime ? (
          <div aria-hidden className="mx-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={
                row.displayState === 'working'
                  ? 'h-full rounded-full bg-callout-note'
                  : 'h-full rounded-full bg-muted-foreground/40'
              }
              style={{ marginLeft: `${offset}%`, width: `${Math.min(width, 100 - offset)}%` }}
            />
          </div>
        ) : null}
        <CollapsibleContent asChild>
          <div className="space-y-1 px-1 pt-2 text-xs">
            {row.model ? (
              <p className="break-all font-mono text-2xs text-muted-foreground">{row.model}</p>
            ) : null}
            {row.detail?.kind === 'message' ? (
              <p className="whitespace-pre-wrap break-words">{row.detail.text}</p>
            ) : row.detail?.kind === 'operation' ? (
              <p className="whitespace-pre-wrap break-words font-mono text-2xs">
                {row.detail.toolName}
                {row.detail.input ? `: ${row.detail.input}` : ''}
              </p>
            ) : null}
            {row.kind === 'agent' && row.providerId && open ? (
              <Button size="xs" variant="ghost" onClick={() => open(row.providerId!)}>
                <ExternalLink aria-hidden className="size-3" />
                {t('components.native-chat.agents.transcript', 'Open transcript')}
              </Button>
            ) : null}
            <span className="sr-only">
              {backgroundTaskKindLabel(row.kind, sayBackgroundTaskTranslated)} ·{' '}
              {agentChildRowName(row)}
            </span>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {row.owned.length ? (
        <ul className="ml-3 border-l border-border pl-2">
          {row.owned.map((child) => (
            <AgentRow key={child.id} row={child} now={now} start={start} end={end} open={open} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
