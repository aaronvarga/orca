import { useState } from 'react'
import { useAppStore } from '@/store'
import { getAiVaultResumeWorkspaceExecutionHostId } from '@/lib/agent-session/resume/history/ai-vault-resume-target'
import { AgentSessionFavoriteMenuItem } from '../../right-sidebar/ai-vault/session-list/AgentSessionFavoriteMenuItem'
import { isAiVaultAgent } from '../../../../../shared/ai-vault/contracts/ai-vault-types'
import { resolveAiVaultTargetWorkspacePath } from '../../right-sidebar/ai-vault/session-actions/ai-vault-session-launch-target'
import {
  resolveTabSessionHistorySubject,
  type NativeChatTabSession
} from './tab-session-history-switch'
import type { TerminalTab } from '../../../../../shared/workspace-layout/terminal-tab-types'
import type { AgentSessionFavorite } from '../../../../../shared/ai-vault/contracts/agent-session-favorites'

export function TabSessionFavoriteMenuItem({
  tab,
  nativeChat
}: {
  tab: Pick<TerminalTab, 'id' | 'worktreeId'>
  nativeChat?: NativeChatTabSession
}) {
  const [favorite] = useState((): AgentSessionFavorite | null => {
    const state = useAppStore.getState()
    const current = state.unifiedTabsByWorktree[tab.worktreeId]?.find(
      (entry) => entry.id === tab.id || entry.entityId === tab.id
    )
    const title = current?.customLabel ?? current?.generatedLabel ?? current?.label
    if (!title) {
      return null
    }
    const executionHostId =
      current?.executionHostId ?? getAiVaultResumeWorkspaceExecutionHostId(state, tab.worktreeId)
    if (!executionHostId) {
      return null
    }
    const cwd = resolveAiVaultTargetWorkspacePath(state, tab.worktreeId)
    if (nativeChat && isAiVaultAgent(nativeChat.agent)) {
      return {
        executionHostId,
        agent: nativeChat.agent,
        sessionId: nativeChat.sessionId,
        structuredSession: { sessionId: nativeChat.sessionId, workspaceId: tab.worktreeId },
        title,
        cwd,
        workspaceId: tab.worktreeId
      }
    }
    const subject = resolveTabSessionHistorySubject(state, { tab, runningAgentsOnly: false })
    return subject?.kind === 'cli'
      ? {
          executionHostId,
          agent: subject.agent,
          sessionId: subject.providerSessionId,
          filePath: subject.filePath,
          title,
          cwd: subject.cwd ?? cwd,
          workspaceId: tab.worktreeId
        }
      : null
  })
  return favorite ? <AgentSessionFavoriteMenuItem session={favorite} /> : null
}
