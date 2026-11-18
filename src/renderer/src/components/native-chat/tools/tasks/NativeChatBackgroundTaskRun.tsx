import { Check, CircleX } from 'lucide-react'
import { TaskRow } from '../../beautiful-ui/TaskRows'
import { useTranslate } from '@/i18n/use-translate'
import { recomputeOn } from '@/lib/recompute-on'
import { AgentStateDot } from '@/components/agent/status/AgentStateDot'
import type { NativeChatBackgroundTaskBlock } from '../../../../../../shared/native-chat/native-chat-types'
import { nativeChatBackgroundTaskRun } from '../../../../../../shared/native-chat/transcript/turns/native-chat-background-task-run'
import { sayBackgroundTaskTranslated } from './background-task-words-text'
import { KIND_ICONS } from './NativeChatBackgroundTasksStatus'

export function NativeChatBackgroundTaskRun({
  block
}: {
  block: NativeChatBackgroundTaskBlock
}): React.JSX.Element {
  const t = useTranslate()
  // The sayer reads translate(); key the row on `t` so its words follow the UI language.
  const row = recomputeOn([t], () =>
    nativeChatBackgroundTaskRun(block, sayBackgroundTaskTranslated)
  )
  const Icon = KIND_ICONS[row.kind]
  const details = row.sentence || row.output || block.error
  return (
    <TaskRow
      active={row.state === 'working' || row.state === 'monitoring'}
      tone={row.state === 'done' ? 'success' : row.state === 'blocked' ? 'error' : 'neutral'}
      status={row.status}
      disclosureKey={`background-task:${block.taskId}`}
      icon={
        row.state === 'done' ? (
          <Check aria-hidden className="size-5 text-status-success" />
        ) : row.state === 'blocked' ? (
          <CircleX aria-hidden className="size-5 text-destructive" />
        ) : (
          <span className="relative flex size-6 items-center justify-center">
            <Icon aria-hidden className="size-4" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <AgentStateDot state={row.state} size="sm" title={null} />
            </span>
          </span>
        )
      }
      details={
        details ? (
          <div className="space-y-1 whitespace-pre-wrap break-words">
            {row.sentence ? <p>{row.sentence}</p> : null}
            {block.error && block.error !== row.sentence ? (
              <p className="text-destructive">{block.error}</p>
            ) : null}
            {row.output ? <p className="break-all font-mono">{row.output}</p> : null}
          </div>
        ) : undefined
      }
    >
      {row.label}
    </TaskRow>
  )
}
