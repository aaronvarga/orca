import { ThinkingState } from '../../beautiful-ui/ThinkingState'
import { translate } from '@/i18n/i18n'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import {
  nativeChatReasoningDisclosureKey,
  nativeChatReasoningHeadline,
  type NativeChatReasoningHeadline
} from '../../../../../../shared/native-chat/transcript/row-content/native-chat-reasoning-row'
import { NativeChatReasoningBody } from './NativeChatReasoningDisclosure'
import { NativeChatToolRunIcon } from '../../tools/lines/NativeChatToolIcon'
import { useNativeChatDisclosure } from '../disclosure/native-chat-disclosure-store'

function translatedHeadline(
  headline: NativeChatReasoningHeadline,
  t: Translate = translate
): string {
  if (headline.kind === 'thoughtFor') {
    return t('components.native-chat.thoughtForDuration', 'Thought for {{duration}}', {
      duration: headline.duration
    })
  }
  return headline.kind === 'thought'
    ? t('components.native-chat.thought', 'Thought')
    : t('components.native-chat.reasoning', 'Reasoning')
}

export function NativeChatReasoningRow({
  message,
  markdown,
  turnIsWorking = false
}: {
  message: Pick<NativeChatMessage, 'id' | 'role' | 'state' | 'completedAt' | 'timestamp'>
  markdown: string
  /** The row's own turn (or subagent) is still running; an open row there has not ended. */
  turnIsWorking?: boolean
}): React.JSX.Element | null {
  const t = useTranslate()
  // Keyed like the live line, so a block opened while it streamed lands open, and windowing keeps it.
  const disclosureKey = nativeChatReasoningDisclosureKey(message.id)
  const disclosure = useNativeChatDisclosure(disclosureKey, false)
  if (!markdown.trim()) {
    return null
  }
  const label = t('components.native-chat.reasoning', 'Reasoning')
  const headline = translatedHeadline(
    nativeChatReasoningHeadline(message, { live: turnIsWorking }),
    t
  )

  return (
    <div className="min-w-0 text-sm text-chat-foreground-faint">
      <ThinkingState
        open={disclosure.open}
        onOpenChange={disclosure.setOpen}
        icon={<NativeChatToolRunIcon iconName="brain" className="text-chat-foreground-faint" />}
        label={
          <>
            {headline === label ? null : <span className="sr-only">{label}: </span>}
            {headline}
          </>
        }
      >
        <NativeChatReasoningBody rowKey={disclosureKey} markdown={markdown} />
      </ThinkingState>
    </div>
  )
}
