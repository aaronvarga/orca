import {
  agentSessionFavoriteKey,
  type AgentSessionFavorite
} from '../../../../../../shared/ai-vault/contracts/agent-session-favorites'
import type {
  AiVaultListArgs,
  AiVaultListResult,
  AiVaultSession
} from '../../../../../../shared/ai-vault/contracts/ai-vault-types'

export async function resolveFavoriteAgentSession(
  favorite: AgentSessionFavorite,
  list: (args: AiVaultListArgs) => Promise<AiVaultListResult>
): Promise<AiVaultSession | null> {
  const result = await list({
    executionHostScope: favorite.executionHostId,
    unlimited: true,
    ...(favorite.cwd ? { scopePaths: [favorite.cwd], scopeOnly: true } : {})
  })
  if (result.cancelled) {
    return null
  }
  const key = agentSessionFavoriteKey(favorite)
  const matches = result.sessions.filter(
    (session) =>
      agentSessionFavoriteKey({ ...session, structuredSession: undefined }) === key &&
      (!favorite.filePath || session.filePath === favorite.filePath)
  )
  return matches.length === 1 ? matches[0]! : null
}
