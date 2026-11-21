import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolChips } from '../../beautiful-ui/ToolChips'
import { NativeChatFileChangeChips } from '../diffs/NativeChatFileChangeChips'
import { useNativeChatDisclosure } from '../../messages/disclosure/native-chat-disclosure-store'
import { Check } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { recomputeOn } from '@/lib/recompute-on'
import {
  isToolCallBlock,
  type NativeChatBackgroundTaskBlock,
  type NativeChatBlock,
  type NativeChatSubagentGroupBlock,
  type NativeChatToolCallBlock
} from '../../../../../../shared/native-chat/native-chat-types'
import { isRenderableSubagentGroup } from '../../../../../../shared/native-chat/transcript/subagents/native-chat-subagent-summary'
import type { NativeChatDiffReveal } from '../../../../../../shared/native-chat/tools/native-chat-turn-diffs'
import { nativeChatToolRunSentence } from './native-chat-tool-run-label'
import { NATIVE_CHAT_TOOL_ACTIVITY_COPY } from '../../../../../../shared/native-chat/tools/native-chat-tool-activity'
import { nativeChatToolRunHeader } from '../../../../../../shared/native-chat/tools/native-chat-tool-run-header'
import { nativeChatAskRunSubject } from '../../../../../../shared/native-chat/input/questions/native-chat-ask-row'
import { NativeChatAwaitingInputRow } from '../../prompts/NativeChatAwaitingInputRow'
import { NativeChatBackgroundTaskRun } from '../tasks/NativeChatBackgroundTaskRun'
import { NativeChatSubagentRun } from '../../subagents/NativeChatSubagentRun'
import { NativeChatToolRunIcon } from '../lines/NativeChatToolIcon'
import { NativeChatToolRunCallCounts } from './NativeChatToolRunCallCounts'
import { revealNativeChatToolRunMember } from './NativeChatToolRunMembers'
import { NativeChatToolRunMemberList } from './NativeChatToolRunMemberList'
import { NativeChatBrowserRunPageButton } from './NativeChatBrowserPageButton'
import { NativeChatImageAttachments } from '../../media/images/NativeChatImageAttachments'
import { nativeChatToolRunViewedImages } from '../../../../../../shared/native-chat/tools/native-chat-tool-viewed-images'
import type { RuntimeFileOperationArgs } from '@/runtime/files/runtime-file-client-types'

/** Insert keyed asides before their block or after the final block. */
export type NativeChatToolRunAsides = {
  before: ReadonlyMap<NativeChatBlock, readonly React.JSX.Element[]>
  after: readonly React.JSX.Element[]
}

/** Stable empty default: a fresh array literal per render breaks memoization. */
const NO_SUBAGENT_GROUPS: NativeChatSubagentGroupBlock[] = []
const NO_BACKGROUND_TASKS: NativeChatBackgroundTaskBlock[] = []

export function NativeChatToolRun({
  blocks,
  previousTodoWrite,
  previousUpdatePlan,
  revealedDiff,
  onRevealDiff,
  subagentGroups = NO_SUBAGENT_GROUPS,
  onOpenSubagent,
  backgroundTasks = NO_BACKGROUND_TASKS,
  followsProse = true,
  expandSignal,
  activeTurnIsWorking,
  trailing,
  disclosureId,
  asides,
  runtimeContext
}: {
  blocks: NativeChatBlock[]
  previousTodoWrite?: NativeChatToolCallBlock
  previousUpdatePlan?: NativeChatToolCallBlock
  revealedDiff?: NativeChatDiffReveal
  onRevealDiff?: (element: HTMLElement) => void
  /** Spawn-group rosters that belong with this run's activity, one row each. */
  subagentGroups?: NativeChatSubagentGroupBlock[]
  /** Opens one of the rosters' subagents in its own view. */
  onOpenSubagent?: (agentId: string) => void
  /** Background tasks that belong with this run's activity, one row each. */
  backgroundTasks?: NativeChatBackgroundTaskBlock[]
  /** The row draws prose above this run, which the run then sits just under. */
  followsProse?: boolean
  /** Legacy view-level default; production native-chat entry points pass false. */
  expandSignal: boolean
  /** Structured lifecycle state, when available, keeps orphaned running calls from spinning. */
  activeTurnIsWorking?: boolean
  /** Only a working turn’s trailing run stays live; omitted means trailing for compatibility. */
  trailing?: boolean
  /** Remember disclosure by message id outside the windowed row’s lifetime. */
  disclosureId?: string
  asides?: NativeChatToolRunAsides
  runtimeContext?: RuntimeFileOperationArgs | null
}): React.JSX.Element | null {
  const t = useTranslate()
  // This row owns the language subscription for its tool, diff, and task labels.
  useTranslation()
  const spacing = followsProse ? 'mt-1' : undefined
  // Rows drawn among the calls count as work too: a reader at the end follows them arriving.
  const asideCount = useMemo(
    () =>
      asides
        ? asides.after.length +
          Array.from(asides.before.values()).reduce((count, rows) => count + rows.length, 0)
        : 0,
    [asides]
  )
  // Key reader overrides by controlling disclosure state so returning restores them without mid-render store writes.
  const runKey =
    disclosureId === undefined
      ? undefined
      : `run:${disclosureId}:${expandSignal}:${revealedDiff?.requestId ?? '-'}`
  const { open, setOpen } = useNativeChatDisclosure(runKey, expandSignal || !!revealedDiff)

  // Share the renderability predicate with slot selection so childless groups cannot create empty margin wrappers.
  const subagentRows = subagentGroups
    .filter(isRenderableSubagentGroup)
    .map((group) => (
      <NativeChatSubagentRun
        key={group.groupId}
        block={group}
        disclosureId={disclosureId}
        onOpenSubagent={onOpenSubagent}
      />
    ))
  // Roster/task rows bypass tool-header hiding because they carry durable state beyond the originating turn.
  const standaloneRows = [
    ...subagentRows,
    ...(backgroundTasks.length > 0
      ? [
          <div
            key="background-tasks"
            className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
          >
            {backgroundTasks.map((task) => (
              <div key={task.taskId} className="border-b border-border last:border-b-0">
                <NativeChatBackgroundTaskRun block={task} />
              </div>
            ))}
          </div>
        ]
      : [])
  ]
  const {
    asks,
    work: headerBlocks,
    askIsActive,
    live,
    callCount,
    fallbackLabel: fallbackKey,
    latestCallLabel,
    iconName: settledHeaderIcon,
    succeeded: runSucceeded,
    failedCallCount,
    interruptedCallCount
  } = useMemo(
    () => nativeChatToolRunHeader(blocks, { activeTurnIsWorking, trailing }),
    [activeTurnIsWorking, blocks, trailing]
  )
  const viewedImages = useMemo(() => nativeChatToolRunViewedImages(headerBlocks), [headerBlocks])
  const hasAskCall = asks.length > 0
  const askSubject = hasAskCall ? nativeChatAskRunSubject(asks) : null
  const showsHeader = !hasAskCall || callCount > 0
  // A single command is more recognizable than its category summary. Its words read translate(), so key it on `t`.
  const runSentence = recomputeOn([t], () => nativeChatToolRunSentence(headerBlocks, { live }))
  // The card sits inside the run's own scroll box, so that box has to move too.
  const revealDiff = useMemo(
    () =>
      onRevealDiff
        ? (card: HTMLElement) => onRevealDiff(revealNativeChatToolRunMember(card))
        : undefined,
    [onRevealDiff]
  )
  const fallbackLabel =
    fallbackKey === 'result'
      ? t('components.native-chat.tool.result', NATIVE_CHAT_TOOL_ACTIVITY_COPY.result)
      : t('components.native-chat.tool.callCount', '{{count}} tool calls', {
          count: callCount,
          defaultValue_one: '{{count}} tool call'
        })

  // Standalone rosters/tasks have no tool calls for a header to summarize.
  if (blocks.length === 0) {
    return standaloneRows.length > 0 ? <div className={spacing}>{standaloneRows}</div> : null
  }

  return (
    <div className={spacing}>
      {standaloneRows}
      {hasAskCall ? (
        <NativeChatAwaitingInputRow
          subject={askSubject}
          pending={askIsActive}
          disclosureKey={disclosureId === undefined ? undefined : `ask:${disclosureId}`}
          // A grouped ask here still names only its count.
          listsQuestions={false}
        />
      ) : null}
      {showsHeader ? (
        <ToolChips
          open={open}
          onOpenChange={setOpen}
          live={live}
          action={<NativeChatBrowserRunPageButton calls={headerBlocks.filter(isToolCallBlock)} />}
          summary={
            <>
              {settledHeaderIcon ? (
                <span className="flex shrink-0 items-center">
                  <NativeChatToolRunIcon
                    iconName={settledHeaderIcon}
                    className="text-chat-foreground-faint"
                  />
                </span>
              ) : null}
              {/* Keep the collapsed header bounded; the tool detail carries the full command. */}
              <span
                className={cn(
                  'min-w-0 line-clamp-2 whitespace-normal break-words font-mono text-xs leading-normal transition-colors',
                  live
                    ? 'max-w-[72%] shrink-0 animate-pulse text-chat-foreground motion-reduce:animate-none'
                    : 'min-w-0 text-chat-foreground-faint group-hover/tool-run:text-chat-foreground'
                )}
              >
                {runSentence ?? fallbackLabel}
              </span>
              <NativeChatToolRunCallCounts
                failed={failedCallCount}
                interrupted={interruptedCallCount}
              />
              {/* Mark only stated success after settlement; idle gaps between live calls are not completion. */}
              {!live && runSucceeded ? (
                <span className="flex shrink-0 items-center">
                  <Check aria-hidden className="size-3 shrink-0 text-chat-foreground-faint" />
                </span>
              ) : null}
              {latestCallLabel ? (
                <span className="flex min-w-0 items-center">
                  <span className="min-w-0 truncate font-mono text-xs text-chat-foreground-faint">
                    {latestCallLabel}
                  </span>
                </span>
              ) : null}
            </>
          }
        >
          <NativeChatToolRunMemberList
            blocks={blocks}
            headerBlocks={headerBlocks}
            asides={asides}
            previousTodoWrite={previousTodoWrite}
            previousUpdatePlan={previousUpdatePlan}
            revealedDiff={revealedDiff}
            onRevealDiff={revealDiff}
            disclosureId={disclosureId}
            followKey={blocks.length + asideCount}
            startsAtEnd={live && !revealedDiff}
            memoryKey={runKey}
          />
          <NativeChatFileChangeChips blocks={blocks} disclosureId={disclosureId} />
        </ToolChips>
      ) : null}
      {/* A read's result is the image the agent saw, so it shows without opening the run. */}
      <NativeChatImageAttachments
        blocks={viewedImages}
        runtimeContext={runtimeContext}
        className="mb-0 mt-1"
      />
    </div>
  )
}
