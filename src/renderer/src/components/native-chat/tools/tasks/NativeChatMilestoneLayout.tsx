import { useState } from 'react'
import { useNativeChatMilestoneVisibility } from './NativeChatMilestoneVisibility'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { ReactNode } from 'react'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { NativeChatMilestonePanel } from './NativeChatMilestonePanel'
import { NativeChatDockedTaskList } from './NativeChatDockedTaskList'

export function NativeChatMilestoneComposer({
  children,
  milestones
}: {
  children: ReactNode
  milestones?: NativeChatMilestones | null
}) {
  const visibility = useNativeChatMilestoneVisibility()
  return (
    <div
      className={cn(
        'shrink-0 [--native-chat-milestone-width:clamp(16rem,28cqw,28rem)]',
        visibility?.shown !== false &&
          !visibility?.bottom &&
          milestones !== undefined &&
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
  waitingForInput
}: {
  children: ReactNode
  lead?: ReactNode
  sessionId: string
  messages: readonly NativeChatMessage[]
  milestones?: NativeChatMilestones | null
  enabled: boolean
  working: boolean
  waitingForInput?: boolean
}) {
  const t = useTranslate()
  const visibility = useNativeChatMilestoneVisibility()
  const [view, setView] = useState('milestones')
  const show = visibility?.shown !== false && enabled && milestones !== undefined
  const bottom = visibility?.bottom === true
  const panel = (
    <NativeChatMilestonePanel
      view={view}
      onViewChange={setView}
      sessionId={sessionId}
      list={milestones ?? null}
      working={working}
      waitingForInput={waitingForInput}
    />
  )
  return (
    <div className="@container/milestones relative flex min-h-0 flex-1 flex-col bg-chat-pane [--native-chat-milestone-width:clamp(16rem,28cqw,28rem)]">
      {lead}
      <div
        className={cn(
          'flex min-h-0 flex-1',
          show && '[&_[data-native-chat-rail]]:hidden',
          show &&
            !bottom &&
            '[--native-chat-milestone-gutter:0px] @min-[1000px]/milestones:[--native-chat-milestone-gutter:calc(var(--native-chat-milestone-width)+var(--spacing)*6)]'
        )}
      >
        {children}
        {show && !bottom ? (
          <aside
            aria-label={t('components.native-chat.milestones.title', 'Milestones')}
            className={cn(
              'absolute top-10 right-3 bottom-3 hidden min-h-0 w-(--native-chat-milestone-width) overflow-hidden @min-[1000px]/milestones:block',
              visibility?.fullHeight && 'z-10 bottom-auto h-[calc(100cqh-var(--spacing)*13)]'
            )}
          >
            {panel}
          </aside>
        ) : null}
      </div>
      {show ? (
        <div
          className={cn(
            '@container/composer-field shrink-0 [--composer-atomic-width:calc(var(--spacing)*10)]',
            !bottom && '@min-[1000px]/milestones:hidden'
          )}
        >
          <div className="native-chat-composer-gutter">
            <div className="mx-auto w-full max-w-(--chat-content-max-width)">{panel}</div>
          </div>
        </div>
      ) : visibility?.shown !== false || !enabled || milestones === undefined ? (
        <NativeChatDockedTaskList key={sessionId} messages={messages} />
      ) : null}
    </div>
  )
}
