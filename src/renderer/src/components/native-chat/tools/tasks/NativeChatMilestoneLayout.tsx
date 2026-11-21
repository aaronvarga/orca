import { collectSessionQuestions } from '../../../../../../shared/native-chat/session-questions'
import type { NativeChatResolvedPrompt } from '../../../../../../shared/native-chat/input/questions/native-chat-resolution-receipt'
import { useMemo } from 'react'
import { collectSessionResources } from '../../../../../../shared/native-chat/session-resources'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import { useNativeChatMilestoneVisibility } from './NativeChatMilestoneVisibility'
import type { ReactNode } from 'react'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { NativeChatMilestonePanel } from './NativeChatMilestonePanel'
import { NativeChatDockedTaskList } from './NativeChatDockedTaskList'
import { NativeChatComposerTabStrip } from '../../composer/controls/NativeChatComposerTabStrip'

export function NativeChatMilestoneComposerSlot({
  enabled,
  milestonesAvailable = true
}: {
  enabled: boolean
  milestonesAvailable?: boolean
}) {
  const visibility = useNativeChatMilestoneVisibility()
  const shown = visibility?.shown
  const right = visibility?.panel.preferences.dock === 'right'
  const resourcesView =
    visibility?.panel.preferences.view === 'resources' ||
    visibility?.panel.preferences.view === 'questions'
  const setComposerSlot = visibility?.setComposerSlot
  return enabled && (milestonesAvailable || resourcesView) && shown ? (
    <NativeChatComposerTabStrip
      attached
      layout="stack"
      data-native-chat-milestones=""
      className={right ? '@min-[1000px]/milestones:hidden' : undefined}
    >
      <div ref={setComposerSlot} className="contents" />
    </NativeChatComposerTabStrip>
  ) : null
}

export function NativeChatMilestoneComposer({
  children,
  enabled,
  milestonesAvailable = true
}: {
  children: ReactNode
  enabled: boolean
  milestonesAvailable?: boolean
}) {
  const visibility = useNativeChatMilestoneVisibility()
  return (
    <div
      className={cn(
        'shrink-0 [--native-chat-milestone-width:clamp(16rem,28cqw,28rem)]',
        enabled &&
          (milestonesAvailable ||
            visibility?.panel.preferences.view === 'resources' ||
            visibility?.panel.preferences.view === 'questions') &&
          visibility?.shown &&
          visibility.panel.preferences.dock === 'right' &&
          '@min-[1000px]/milestones:pr-[calc(var(--native-chat-milestone-width)+var(--spacing)*6)]'
      )}
    >
      {children}
    </div>
  )
}

export function NativeChatMilestoneLayout({
  children,
  lead,
  sessionId,
  messages,
  milestones,
  enabled,
  working,
  waitingForInput,
  loadingEarlier,
  onLoadEarlier,
  historyIncomplete,
  receipts
}: {
  children: ReactNode
  lead?: ReactNode
  sessionId: string
  messages: readonly NativeChatMessage[]
  milestones?: NativeChatMilestones | null
  enabled: boolean
  working: boolean
  waitingForInput?: boolean
  historyIncomplete?: boolean
  loadingEarlier?: boolean
  onLoadEarlier?: () => void
  receipts?: ReadonlyMap<string, NativeChatResolvedPrompt>
}) {
  const visibility = useNativeChatMilestoneVisibility()
  const t = useTranslate()
  const right = visibility?.panel.preferences.dock === 'right'
  const questions = useMemo(
    () => collectSessionQuestions(messages, receipts ?? new Map()),
    [messages, receipts]
  )
  const resources = useMemo(() => collectSessionResources(messages), [messages])
  const show =
    visibility?.shown !== false &&
    enabled &&
    (milestones !== undefined ||
      visibility?.panel.preferences.view === 'resources' ||
      visibility?.panel.preferences.view === 'questions')
  const panel = (
    <NativeChatMilestonePanel
      sessionId={sessionId}
      list={milestones ?? null}
      working={working}
      waitingForInput={waitingForInput}
      resources={resources}
      questions={questions}
      loadingEarlier={loadingEarlier}
      onLoadEarlier={onLoadEarlier}
      historyIncomplete={historyIncomplete}
    />
  )
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-chat-pane [--native-chat-milestone-width:clamp(16rem,28cqw,28rem)]">
      {lead}
      <div
        className={cn(
          'flex min-h-0 flex-1',
          show &&
            right &&
            '[&_[data-native-chat-rail]]:hidden @min-[1000px]/milestones:[--native-chat-milestone-gutter:calc(var(--native-chat-milestone-width)+var(--spacing)*6)]'
        )}
      >
        {children}
        {show && right ? (
          <aside
            aria-label={t('components.native-chat.milestones.title', 'Milestones')}
            className="absolute top-10 right-3 hidden h-[calc(100cqh-var(--spacing)*13)] min-h-0 w-(--native-chat-milestone-width) overflow-hidden @min-[1000px]/milestones:block"
          >
            {panel}
          </aside>
        ) : null}
      </div>
      {show ? (
        visibility?.composerSlot ? (
          createPortal(panel, visibility.composerSlot)
        ) : visibility ? null : (
          <NativeChatComposerTabStrip layout="stack">{panel}</NativeChatComposerTabStrip>
        )
      ) : visibility?.shown !== false || !enabled || milestones === undefined ? (
        <NativeChatDockedTaskList key={sessionId} messages={messages} />
      ) : null}
    </div>
  )
}
