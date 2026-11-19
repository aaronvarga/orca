import { milestoneOverallEta } from '../../../../../../src/shared/native-chat/input/task-lists/native-chat-milestone-eta'
import { MobileNativeChatMilestonePreview } from './MobileNativeChatMilestonePreview'
import type { RpcClient } from '../../../../transport/rpc/rpc-client-contract'
import type { NativeChatMilestones } from '../../../../../../src/shared/native-chat/input/task-lists/native-chat-milestones'
import { memo, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronUp, ListChecks } from 'lucide-react-native'
import {
  nativeChatCompletedTaskCount,
  nativeChatTaskLabel,
  type NativeChatTaskList
} from '../../../../../../src/shared/native-chat/input/task-lists/native-chat-task-list'
import { useMobileTranslation } from '../../../../i18n/use-mobile-translation'
import { colors, spacing, typography } from '../../../../theme/mobile-theme'
import { themedStyleSheet } from '../../../../theme/themed-styles'
import { useMobileColorScheme } from '../../../../theme/use-mobile-color-scheme'
import { toolStyles, toolType } from '../../transcript/tool-results/mobile-native-chat-tool-styles'
import { MobileNativeChatChecklist } from './MobileNativeChatTaskList'
import { nativeChatTaskListCopy } from './native-chat-task-list-copy'
import { trayStripStyles as strip } from './mobile-native-chat-tray-strip-styles'

const VISIBLE_ROWS = 6
const MAX_REMEMBERED = 64
// The strip remounts whenever the chat view does, so each conversation's choice lives here.
const openByConversation = new Map<string, boolean>()

function useConversationOpen(
  conversationKey: string,
  initialOpen: boolean
): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => openByConversation.get(conversationKey) ?? initialOpen)
  const remember = (next: boolean): void => {
    openByConversation.delete(conversationKey)
    openByConversation.set(conversationKey, next)
    const oldest = openByConversation.keys().next().value
    if (openByConversation.size > MAX_REMEMBERED && oldest !== undefined) {
      openByConversation.delete(oldest)
    }
    setOpen(next)
  }
  return [open, remember]
}

function MobileNativeChatDockedTaskListImpl({
  list,
  milestones,
  milestoneClient,
  preparingMilestones,
  conversationKey
}: {
  milestoneClient?: RpcClient
  milestones?: NativeChatMilestones | null
  preparingMilestones?: boolean
  list: NativeChatTaskList | null
  conversationKey: string
}): React.JSX.Element {
  useMobileColorScheme()
  const t = useMobileTranslation()
  const [open, setOpen] = useConversationOpen(
    conversationKey,
    milestones != null || preparingMilestones === true
  )
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  list = list ?? { tasks: [] }
  const total = milestoneOverallEta(list.tasks)
  const completed = nativeChatCompletedTaskCount(list)
  const copy = nativeChatTaskListCopy(t, { completed, total: list.tasks.length })
  const current = list.tasks.find((task) => task.status === 'in_progress')
  // Collapsed, the header names where the agent is; open, the checklist does.
  const lead =
    !open && current
      ? nativeChatTaskLabel(current)
      : milestones
        ? t('components.native-chat.milestones.title', 'Milestones')
        : preparingMilestones
          ? t('components.native-chat.milestones.preparing', 'Preparing milestones…')
          : copy.title
  return (
    <View style={strip.list} testID="docked-task-list">
      <View style={strip.box}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${lead}, ${copy.progress}`}
          hitSlop={spacing.xs}
          style={({ pressed }) => [strip.header, pressed && strip.pressed]}
          onPress={() => {
            setNow(Date.now())
            setOpen(!open)
          }}
        >
          <ListChecks size={14} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.lead} numberOfLines={1} ellipsizeMode="tail">
            {lead}
          </Text>
          <Text style={styles.count}>{`${completed}/${list.tasks.length}`}</Text>
          <View style={open ? strip.caretOpen : undefined}>
            <ChevronUp size={14} color={colors.textMuted} strokeWidth={2} />
          </View>
        </Pressable>
        {open ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            nestedScrollEnabled
          >
            {milestones?.saveError ? (
              <Text style={styles.explanation}>
                {t(
                  'components.native-chat.milestones.saveError',
                  'Milestones could not be saved. Orca will retry on the next update.'
                )}
              </Text>
            ) : null}
            {milestones ? (
              <Text style={[toolStyles.lineMeta, toolType(1).meta, styles.explanation]}>
                {total.eta
                  ? `${t('components.native-chat.milestones.remaining', 'Agent time remaining')}: ${total.eta}${total.incomplete ? '+' : ''}\n`
                  : ''}
                {milestones.updatedAt
                  ? `${t('components.native-chat.milestones.updatedAgo', 'Updated {{minutes}} min ago', { minutes: Math.max(0, Math.floor((now - milestones.updatedAt) / 60000)) })}`
                  : ''}
              </Text>
            ) : null}
            <MobileNativeChatChecklist list={list} fontScale={1} />
            {milestones?.filePath && !milestones.saveError && milestoneClient ? (
              <MobileNativeChatMilestonePreview
                client={milestoneClient}
                filePath={milestones.filePath}
              />
            ) : null}
            {list.explanation ? (
              <Text style={[toolStyles.lineMeta, toolType(1).meta, styles.explanation]}>
                {list.explanation}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </View>
  )
}

export const MobileNativeChatDockedTaskList = memo(MobileNativeChatDockedTaskListImpl)

const styles = themedStyleSheet(() => ({
  lead: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '500'
  },
  count: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    fontVariant: ['tabular-nums']
  },
  body: {
    // About six checklist rows, then the list scrolls.
    maxHeight: VISIBLE_ROWS * (toolType(1).row.lineHeight + spacing.xs) + spacing.xs
  },
  bodyContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  explanation: {
    paddingTop: spacing.xs
  }
}))
