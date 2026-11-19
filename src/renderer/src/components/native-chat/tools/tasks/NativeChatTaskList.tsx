import { NativeChatMarkdown } from '../../markdown/NativeChatMarkdown'
import { formatNativeChatDuration } from '../../../../../../shared/native-chat/transcript/turns/native-chat-turn-status'
import { cn } from '@/lib/class-names'
import { TaskRow as BeautifulTaskRow } from '../../beautiful-ui/TaskRows'
import { Check, LoaderCircle, ChevronRight, ListChecks } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { useNativeChatDisclosure } from '../../messages/disclosure/native-chat-disclosure-store'
import {
  diffNativeChatTaskLists,
  nativeChatCompletedTaskCount,
  nativeChatTaskChangeWords,
  nativeChatTaskLabel,
  type NativeChatTask,
  type NativeChatTaskChange,
  type NativeChatTaskList as TaskList
} from '../../../../../../shared/native-chat/input/task-lists/native-chat-task-list'

function statusLabel(task: NativeChatTask, t: Translate = translate): string {
  if (task.status === 'completed') {
    return t('components.native-chat.taskList.completed', 'Completed')
  }
  if (task.blocker?.kind === 'waiting') {
    return t('components.native-chat.milestones.waiting', 'Waiting on you')
  }
  if (task.blocker) {
    return t('components.native-chat.milestones.blocked', 'Blocked')
  }
  if (task.status === 'in_progress') {
    return t('components.native-chat.taskList.inProgress', 'In progress')
  }
  return t('components.native-chat.taskList.pending', 'Pending')
}

function changeLabel(change: NativeChatTaskChange, t: Translate = translate): string {
  const { key, task } = nativeChatTaskChangeWords(change)
  switch (key) {
    case 'added':
      return t('components.native-chat.taskList.added', 'Added {{task}}', { task })
    case 'removed':
      return t('components.native-chat.taskList.removed', 'Removed {{task}}', { task })
    case 'started':
      return t('components.native-chat.taskList.started', 'Started {{task}}', { task })
    case 'finished':
      return t('components.native-chat.taskList.finished', 'Completed {{task}}', { task })
    case 'reset':
      return t('components.native-chat.taskList.reset', 'Marked pending: {{task}}', {
        task
      })
    case 'updated':
      return t('components.native-chat.taskList.updated', 'Updated {{task}}', { task })
  }
}

function TaskRow({
  task,
  label,
  index,
  compact,
  disclosureKey
}: {
  task: NativeChatTask
  label?: string
  index: number
  compact?: boolean
  disclosureKey?: string
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <li className="min-w-0 border-b border-border last:border-b-0">
      <BeautifulTaskRow
        compact={compact}
        icon={
          task.status === 'completed' ? (
            <span
              className={cn(
                'flex items-center justify-center rounded-full bg-status-success-background text-status-success',
                compact ? 'size-5' : 'size-6'
              )}
            >
              <Check aria-hidden className={compact ? 'size-3.5' : 'size-4'} />
            </span>
          ) : (
            <span
              className={cn(
                'relative flex items-center justify-center text-xs tabular-nums',
                compact ? 'size-5' : 'size-6'
              )}
            >
              {task.status === 'in_progress' && !task.blocker ? (
                <LoaderCircle
                  aria-hidden
                  className={cn(
                    'absolute animate-spin motion-reduce:animate-none',
                    compact ? 'size-5' : 'size-6'
                  )}
                />
              ) : null}
              <span className="text-3xs">{index + 1}</span>
            </span>
          )
        }
        active={task.status === 'in_progress' && !task.blocker}
        tone={
          task.status === 'completed'
            ? 'success'
            : task.status === 'in_progress' && !task.blocker
              ? 'progress'
              : 'neutral'
        }
        status={statusLabel(task, t)}
        statusDescription={task.status !== 'completed' ? task.blocker?.reason : undefined}
        eta={
          task.eta && task.status !== 'completed' ? (
            <span
              title={t(
                'components.native-chat.milestones.etaTitle',
                'Estimated agent time remaining'
              )}
            >
              {task.eta}
            </span>
          ) : undefined
        }
        disclosureKey={disclosureKey}
        details={
          task.details ? (
            <NativeChatMarkdown content={task.details} />
          ) : task.activeForm && task.activeForm !== task.content ? (
            <p className="whitespace-pre-wrap break-words">
              {task.status === 'in_progress' ? task.content : task.activeForm}
            </p>
          ) : undefined
        }
      >
        {label ?? nativeChatTaskLabel(task)}
      </BeautifulTaskRow>
      {task.status === 'completed' && task.timing ? (
        <p className="px-2 pb-1 font-mono text-3xs text-muted-foreground">
          {t('components.native-chat.milestones.actual', 'Observed {{time}}', {
            time: formatNativeChatDuration(task.timing.elapsedMs / 1000)
          })}
          {task.timing.estimate
            ? ` · ${t('components.native-chat.milestones.initialEstimate', 'estimated {{eta}}', { eta: task.timing.estimate })}`
            : ''}
        </p>
      ) : null}
    </li>
  )
}

export function Checklist({
  list,
  compact,
  disclosureKey
}: {
  list: TaskList
  compact?: boolean
  disclosureKey?: string
}): React.JSX.Element {
  const t = useTranslate()
  const occurrences = new Map<string, number>()
  return list.tasks.length === 0 ? (
    <p className="text-xs">{t('components.native-chat.taskList.empty', 'No tasks')}</p>
  ) : (
    <ul
      aria-label={t('components.native-chat.taskList.title', 'Tasks')}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
    >
      {list.tasks.map((task, index) => {
        const occurrence = occurrences.get(task.content) ?? 0
        occurrences.set(task.content, occurrence + 1)
        return (
          <TaskRow
            key={task.id ?? `${task.content}:${occurrence}`}
            task={task}
            index={index}
            compact={compact}
            disclosureKey={
              disclosureKey === undefined
                ? undefined
                : `${disclosureKey}:${task.content}:${occurrence}`
            }
          />
        )
      })}
    </ul>
  )
}

function taskProgressLabel(completed: number, total: number, t: Translate = translate): string {
  return t(
    'components.native-chat.taskList.progress',
    '{{completed}} of {{count}} tasks completed',
    { completed, count: total, defaultValue_one: '{{completed}} of {{count}} task completed' }
  )
}

export function NativeChatTaskList({
  list,
  previous,
  presentation = 'inline',
  disclosureKey
}: {
  list: TaskList
  previous?: TaskList
  presentation?: 'inline' | 'composer'
  /** Identity the full list's open state is remembered under while its row is unmounted. */
  disclosureKey?: string
}): React.JSX.Element {
  const t = useTranslate()
  const fullList = useNativeChatDisclosure(disclosureKey, false)
  const completed = nativeChatCompletedTaskCount(list)
  if (presentation === 'composer') {
    return (
      <Collapsible asChild defaultOpen>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ListChecks aria-hidden className="size-4 shrink-0" />
              <span className="flex-1 font-medium">
                {t('components.native-chat.taskList.title', 'Tasks')}
              </span>
              <span
                className="tabular-nums"
                aria-label={taskProgressLabel(completed, list.tasks.length, t)}
              >
                {completed}/{list.tasks.length}
              </span>
              <ChevronRight aria-hidden className="size-3.5 group-data-[state=open]:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-64 overflow-y-auto border-t border-border px-3 py-2 text-sm text-muted-foreground scrollbar-sleek">
              <Checklist list={list} disclosureKey={disclosureKey} />
              {list.explanation ? (
                <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {list.explanation}
                </p>
              ) : null}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  }
  const changes = previous ? diffNativeChatTaskLists(previous, list) : null
  return (
    <div className="space-y-1 py-1 text-sm text-chat-foreground-faint">
      <div className="flex items-center gap-1.5 text-xs text-chat-foreground-faint">
        <ListChecks aria-hidden className="size-4 shrink-0" />
        <span className="font-medium">{t('components.native-chat.taskList.title', 'Tasks')}</span>
        <span
          className="tabular-nums"
          aria-label={taskProgressLabel(completed, list.tasks.length, t)}
        >
          {completed}/{list.tasks.length}
        </span>
      </div>
      {changes ? (
        <>
          {changes.length > 0 ? (
            <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {changes.map((change, index) => (
                <TaskRow
                  key={`${change.kind}:${index}`}
                  task={change.task}
                  index={index}
                  disclosureKey={
                    disclosureKey === undefined ? undefined : `${disclosureKey}:change:${index}`
                  }
                  label={changeLabel(change, t)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-chat-foreground-faint">
              {t('components.native-chat.taskList.unchanged', 'Tasks unchanged')}
            </p>
          )}
          <Collapsible open={fullList.open} onOpenChange={fullList.setOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1 rounded py-0.5 text-xs text-chat-foreground-faint hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight aria-hidden className="size-3.5 group-data-[state=open]:rotate-90" />
                {t('components.native-chat.taskList.showAll', 'Full task list')}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent animation="height" data-native-chat-member-detail>
              <Checklist list={list} disclosureKey={disclosureKey} />
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        <Checklist list={list} disclosureKey={disclosureKey} />
      )}
      {list.explanation ? (
        <p className="whitespace-pre-wrap break-words text-xs text-chat-foreground-faint">
          {list.explanation}
        </p>
      ) : null}
    </div>
  )
}
