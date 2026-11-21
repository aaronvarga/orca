import { splitOpenCodeSqliteCandidate } from '../../../../../shared/agent-session/lifecycle/provider-handles/opencode-sqlite-session-path'
import type { LaunchSource } from '../../../../../shared/telemetry/schemas/telemetry-property-schemas'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

export type AgentSessionContinuationSource = {
  sourceAgent: TuiAgent | null
  sourceKind?: 'chat'
  capturedText: string
  sourceLabel?: string | null
  sourceTitle?: string | null
  sourceWorkingDirectory?: string | null
  transcriptPath?: string | null
  lastPrompt?: string | null
  lastAssistantMessage?: string | null
}

export type AgentSessionContinuationRequest = {
  handoffSource?: {
    tabId: string
    worktreeId: string
    sessionId?: string
    terminalLeafId?: string
    progress?: string
  }
  source: AgentSessionContinuationSource
  worktreeId: string
  groupId?: string | null
  workspacePath: string
  initialCwd?: string | null
  launchSource: LaunchSource
  avoidSourceAgent?: boolean
}

export function canPrepareAgentSessionContinuation(
  source: AgentSessionContinuationSource
): boolean {
  return (
    source.sourceAgent !== null &&
    Boolean(resolveAgentSessionContinuationTranscriptPath(source) || source.capturedText.trim())
  )
}

export function resolveAgentSessionContinuationTranscriptPath(
  source: Pick<AgentSessionContinuationSource, 'sourceAgent' | 'transcriptPath'>
): string | null {
  const path = source.transcriptPath?.trim() || null
  if (!path) {
    return null
  }
  const agent = source.sourceAgent
  // A database row reference names a whole store, never one readable transcript.
  if (
    (agent === 'opencode' || agent === 'opencode2' || agent === 'hermes') &&
    splitOpenCodeSqliteCandidate(path, agent)
  ) {
    return null
  }
  return path
}
