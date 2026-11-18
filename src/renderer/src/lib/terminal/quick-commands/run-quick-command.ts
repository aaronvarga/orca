import { toast } from 'sonner'
import { useAppStore } from '@/store/index'
import { translate } from '@/i18n/i18n'
import { PASTE_TERMINAL_TEXT_EVENT, type PasteTerminalTextDetail } from '@/constants/terminal'
import { nativeChatComposerDestination } from '@/components/native-chat/composer/focus/native-chat-composer-destination'
import {
  nativeChatComposerRootForTab,
  requestNativeChatComposerFocus
} from '@/components/native-chat/composer/focus/native-chat-composer-focus-intent'
import { getTerminalQuickCommandBody } from '../../../../../shared/terminal/quick-commands/terminal-quick-commands'
import {
  runQuickCommandInNewTab,
  type RunQuickCommandInNewTabArgs
} from './run-quick-command-in-new-tab'

export function runQuickCommand(
  args: RunQuickCommandInNewTabArgs & { tabId?: string; paneId?: number }
): void {
  if (args.command.newSession !== false) {
    runQuickCommandInNewTab(args)
    return
  }
  const state = useAppStore.getState()
  const groupId = args.groupId ?? state.activeGroupIdByWorktree[args.worktreeId]
  const activeId =
    args.tabId ??
    state.groupsByWorktree[args.worktreeId]?.find((group) => group.id === groupId)?.activeTabId
  const tab = state.unifiedTabsByWorktree[args.worktreeId]?.find(
    (candidate) =>
      candidate.id === activeId ||
      (candidate.contentType === 'terminal' && candidate.entityId === activeId)
  )
  const fail = (): void => {
    toast.error(
      translate(
        'components.quickCommands.inputUnavailable',
        'Open a session that accepts input to insert this quick command.'
      )
    )
  }
  if (!tab || (tab.contentType !== 'terminal' && tab.contentType !== 'agent-session')) {
    fail()
    return
  }
  const text = getTerminalQuickCommandBody(args.command)
  if (!text.trim()) {
    return
  }
  const tabId = tab.contentType === 'terminal' ? tab.entityId : tab.id
  const root = nativeChatComposerRootForTab(tabId)
  const remember = (): void => {
    if (groupId) {
      useAppStore
        .getState()
        .setRecentQuickCommandForGroup(groupId, args.historyId ?? args.command.id)
    }
  }
  if (root) {
    if (nativeChatComposerDestination(root, null)?.insertTypedText(text)) {
      remember()
      requestNativeChatComposerFocus(tabId)
    } else {
      fail()
    }
    return
  }
  if (tab.contentType !== 'terminal' || tab.viewMode === 'chat') {
    fail()
    return
  }
  const claimed = !window.dispatchEvent(
    new CustomEvent<PasteTerminalTextDetail>(PASTE_TERMINAL_TEXT_EVENT, {
      cancelable: true,
      detail: {
        tabId,
        paneId: args.paneId,
        text,
        onResult: (inserted) => (inserted ? remember() : fail())
      }
    })
  )
  if (!claimed) {
    fail()
  }
}
