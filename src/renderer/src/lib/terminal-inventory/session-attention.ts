import type { AppState } from '@/store/types'
import type { CommandCenterSession } from './terminal-inventory-state'
import { makePaneKey, isTerminalLeafId } from '../../../../shared/workspace-layout/stable-pane-id'

export function hasInventorySessionAttention(
  session: CommandCenterSession,
  state: Pick<AppState, 'terminalLayoutsByTabId' | 'unreadAgentCompletionPanes'>
): boolean {
  return (
    session.available &&
    isTerminalLeafId(session.terminal.leafId) &&
    Boolean(session.terminal.tabId) &&
    !session.terminal.tabId.includes(':') &&
    state.terminalLayoutsByTabId[session.terminal.tabId]?.ptyIdsByLeafId?.[
      session.terminal.leafId
    ] === session.previewPtyId &&
    Boolean(
      state.unreadAgentCompletionPanes[makePaneKey(session.terminal.tabId, session.terminal.leafId)]
    )
  )
}
