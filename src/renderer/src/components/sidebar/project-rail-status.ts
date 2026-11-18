import type { AppState } from '@/store/types'
import type { AgentDotState } from '@/components/agent/status/AgentStateDot'
import type { CommandCenterChatTile } from '../command-center/CommandCenterView'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import { resolveRowProgramStatus } from '@/lib/program-status/agent-row-presentation'
import { AGENT_LIST_STATUS_RANK } from '../../../../shared/agent-status/presentation/agent-list-status'
import { structuredAgentSessionPaneKey } from '../../../../shared/agent-session/view/structured-agent-session-projection'

import type { CommandCenterSession } from '@/lib/terminal-inventory/terminal-inventory-state'

export type ProjectRailSession =
  | (CommandCenterSession & { kind?: 'terminal' })
  | CommandCenterChatTile

export type ProjectRailStatus = {
  count: number
  unread: boolean
  state?: AgentDotState
  progress?: number
}

type StatusState = Pick<
  AppState,
  'agentStatusByPaneKey' | 'terminalLayoutsByTabId' | 'unreadAgentCompletionPanes'
>

export function getProjectRailStatus(
  sessions: readonly ProjectRailSession[],
  state: StatusState
): ProjectRailStatus {
  const status: ProjectRailStatus = { count: 0, unread: false }
  let liveAgents = 0
  for (const session of sessions) {
    if (!session.available) {
      continue
    }
    status.count++
    const chat = session.kind === 'chat'
    const paneKey = chat
      ? structuredAgentSessionPaneKey(session.tab.id, session.tab.entityId)
      : `${session.terminal.tabId}:${session.terminal.leafId}`
    // A restored or replaced pane must not lend its status to a different live process.
    if (
      !chat &&
      state.terminalLayoutsByTabId[session.terminal.tabId]?.ptyIdsByLeafId?.[
        session.terminal.leafId
      ] !== session.previewPtyId
    ) {
      continue
    }
    const row = state.agentStatusByPaneKey.projection.row(paneKey)
    const worktreeId = chat ? session.tab.worktreeId : session.terminal.worktreeId
    if (!row || row.entry.worktreeId !== worktreeId) {
      continue
    }
    status.unread ||= Boolean(state.unreadAgentCompletionPanes[paneKey])
    const program = resolveRowProgramStatus(row)
    const dotState = program.dotStateOverride ?? agentRowDisplayDotState(row)
    if (
      dotState === 'working' ||
      dotState === 'waiting' ||
      dotState === 'blocked' ||
      dotState === 'permission'
    ) {
      liveAgents++
    }
    if (!status.state || AGENT_LIST_STATUS_RANK[dotState] < AGENT_LIST_STATUS_RANK[status.state]) {
      status.state = dotState
      status.progress = program.presentation.progress
    }
  }
  // Independent agents have no shared percentage; keep their activity indeterminate.
  if (liveAgents > 1) {
    status.progress = undefined
  }
  return status
}
