import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealWorkspaceWithOutcome } from '@/lib/workspace/activation/worktree-activation'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { structuredAgentSessionOwnerForTab } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { guardPinnedTabClose } from '@/store/slices/tabs/closing/pinned-tab-close-guard'
import type { CommandCenterChatTile } from './CommandCenterView'

function currentChat(session: CommandCenterChatTile) {
  const state = useAppStore.getState()
  const tab = state.unifiedTabsByWorktree[session.tab.worktreeId]?.find(
    (tab) =>
      tab.id === session.tab.id &&
      tab.contentType === 'agent-session' &&
      tab.entityId === session.tab.entityId &&
      structuredAgentSessionOwnerForTab(state, tab) === session.ownerId
  )
  if (!tab) {
    throw new Error(
      translate('commandCenter.chatGone', 'This chat is no longer open. Refresh Command Center.')
    )
  }
  return tab
}

export async function openCommandCenterChat(session: CommandCenterChatTile): Promise<void> {
  const tab = currentChat(session)
  const result = activateAndRevealWorkspaceWithOutcome(tab.worktreeId, {
    executionHostId: session.ownerId,
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
  if (
    'refused' in result ||
    !activateStructuredAgentSessionTab({
      worktreeId: tab.worktreeId,
      tabId: tab.id,
      target: session.chat.target
    })
  ) {
    throw new Error(
      translate('commandCenter.chatOpenFailed', 'The chat could not be opened on its host.')
    )
  }
}

export async function closeCommandCenterChat(session: CommandCenterChatTile): Promise<void> {
  const tab = currentChat(session)
  return new Promise((resolve, reject) => {
    guardPinnedTabClose({
      isPinned: tab.isPinned === true,
      tabLabel: session.title,
      onCancel: resolve,
      onClose: () => {
        try {
          const current = currentChat(session)
          useAppStore.getState().closeUnifiedTab(current.id)
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    })
  })
}
