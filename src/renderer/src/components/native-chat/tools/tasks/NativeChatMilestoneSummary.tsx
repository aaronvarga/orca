import { getIntlLocale } from '@/i18n/i18n'
import { useEffect, useState } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { milestoneOverallEta } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestone-eta'

export function NativeChatMilestoneSummary({
  list,
  waitingForInput
}: {
  list: NativeChatMilestones
  waitingForInput?: boolean
}) {
  const t = useTranslate()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  const total = milestoneOverallEta(list.tasks)
  const age =
    list.updatedAt === undefined ? null : Math.max(0, Math.floor((now - list.updatedAt) / 60000))
  const waiting =
    waitingForInput ||
    list.tasks.some((task) => task.status !== 'completed' && task.blocker?.kind === 'waiting')
  return (
    <div className="space-y-1 px-1 py-1 text-xs text-muted-foreground">
      {!total.eta && list.tasks.some((task) => task.status !== 'completed') ? (
        <span>
          {t('components.native-chat.milestones.etaMissing', 'Remaining time not estimated')}
        </span>
      ) : null}
      {total.parallel ? (
        <p>
          {t('components.native-chat.milestones.parallelIncluded', 'Includes parallel agent work.')}
        </p>
      ) : null}
      {total.incomplete && total.eta ? (
        <p>
          {t(
            'components.native-chat.milestones.partialEta',
            'Partial estimate; some milestones have no ETA.'
          )}
        </p>
      ) : null}
      <p
        title={
          list.updatedAt === undefined
            ? undefined
            : new Date(list.updatedAt).toLocaleString(getIntlLocale())
        }
      >
        {age === null
          ? t('components.native-chat.milestones.freshnessUnknown', 'Update time unavailable')
          : age === 0
            ? t('components.native-chat.milestones.justUpdated', 'Updated just now')
            : t('components.native-chat.milestones.updatedAgo', 'Updated {{minutes}} min ago', {
                minutes: age
              })}
        {age !== null && age >= 10
          ? ` · ${t('components.native-chat.milestones.stale', 'Refresh recommended')}`
          : ''}
      </p>
      {waiting || total.blocked ? (
        <div role="status" className="space-y-1">
          <p className="font-medium text-foreground">
            {waiting
              ? t('components.native-chat.milestones.waiting', 'Waiting on you')
              : t('components.native-chat.milestones.blocked', 'Blocked')}
            {' · '}
            {t(
              'components.native-chat.milestones.waitExcluded',
              'Wait time is excluded from the ETA.'
            )}
          </p>
        </div>
      ) : null}
    </div>
  )
}
