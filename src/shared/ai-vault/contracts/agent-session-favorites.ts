import type { AiVaultSession } from './ai-vault-types'

export type AgentSessionFavorite = Pick<
  AiVaultSession,
  'executionHostId' | 'agent' | 'sessionId' | 'title' | 'cwd' | 'structuredSession'
> & { workspaceId?: string; filePath?: string }

export function agentSessionFavoriteKey(session: AgentSessionFavorite): string {
  return JSON.stringify([
    session.executionHostId,
    session.structuredSession ? 'chat' : session.agent === 'opencode' ? 'opencode2' : session.agent,
    session.structuredSession?.sessionId ?? session.sessionId
  ])
}

export function agentSessionFavorite(
  session: AgentSessionFavorite,
  workspaceId?: string
): AgentSessionFavorite {
  return {
    executionHostId: session.executionHostId,
    agent: session.agent,
    sessionId: session.sessionId,
    title: session.title,
    cwd: session.cwd,
    filePath: session.filePath,
    structuredSession: session.structuredSession,
    workspaceId: session.structuredSession?.workspaceId ?? workspaceId
  }
}
