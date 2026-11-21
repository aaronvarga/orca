import { Button } from '@/components/ui/button'
import { MessageSquareText } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { SessionQuestion } from '../../../../../shared/native-chat/session-questions'

export function NativeChatSessionQuestions({
  questions,
  historyIncomplete,
  loadingEarlier,
  onLoadEarlier
}: {
  questions: readonly SessionQuestion[]
  historyIncomplete?: boolean
  loadingEarlier?: boolean
  onLoadEarlier?: () => void
}) {
  const t = useTranslate()
  return (
    <div className="min-w-0 px-2 py-2" data-native-chat-session-questions="">
      {questions.length ? (
        <ol className="min-w-0 divide-y divide-border">
          {questions.map((entry) => (
            <li key={entry.id} className="space-y-2 py-3 first:pt-0">
              <p className="text-sm font-medium whitespace-pre-wrap wrap-anywhere">
                {entry.question}
              </p>
              <div className="border-l border-border pl-3">
                <p className="text-2xs text-muted-foreground">
                  {t('components.native-chat.questions.answer', 'Your answer')}
                </p>
                <p className="text-sm whitespace-pre-wrap wrap-anywhere">
                  {entry.answer === null
                    ? entry.state === 'cancelled'
                      ? t('components.native-chat.questions.cancelled', 'Cancelled')
                      : t('components.native-chat.questions.unanswered', 'No recorded answer')
                    : entry.answer ||
                      t('components.native-chat.receipt.emptyAnswer', 'Empty answer')}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-muted-foreground">
          <MessageSquareText aria-hidden className="size-5" />
          <p className="text-sm font-medium">
            {t('components.native-chat.questions.empty', 'No questions yet')}
          </p>
          <p className="text-xs">
            {t(
              'components.native-chat.questions.emptyHint',
              'Questions asked through the question controls and your recorded answers appear here.'
            )}
          </p>
        </div>
      )}
      {historyIncomplete ? (
        <div className="space-y-2 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">
            {t(
              'components.native-chat.questions.earlierHistory',
              'Showing loaded history. Load earlier messages to include older questions and answers.'
            )}
          </p>
          {onLoadEarlier ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loadingEarlier}
              onClick={onLoadEarlier}
            >
              {loadingEarlier
                ? t('components.native-chat.questions.loadingEarlier', 'Loading earlier messages…')
                : t('components.native-chat.questions.loadEarlier', 'Load earlier messages')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
