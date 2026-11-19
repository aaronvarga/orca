import type { NativeChatSubagentEntry } from '../../native-chat-types'
import type { AgentChildWorkView } from '../../../agent-status/child-work/agent-status-child-work-view'
import {
  buildAgentChildRowModels,
  type AgentChildRowContext
} from '../../../agent-status/presentation/agent-child-row-model'

/** Keep settled history after live rosters disappear; old live claims need fresh host evidence. */
export function nativeChatAgentRows(
  entries: readonly NativeChatSubagentEntry[],
  live: readonly AgentChildWorkView[],
  context: AgentChildRowContext,
  parents: ReadonlyMap<string, string> = new Map()
) {
  const views = new Map<string, AgentChildWorkView>()
  for (const entry of entries) {
    const settled = ['completed', 'failed', 'stopped'].includes(entry.state)
    views.set(entry.id, {
      id: entry.id,
      providerId: entry.id,
      kind: 'agent',
      name: entry.label,
      agentType: entry.agentType,
      model: entry.model,
      state: settled ? 'done' : 'unverifiable',
      membership: settled ? 'settled' : 'live',
      ...(settled
        ? {
            outcome:
              entry.state === 'completed'
                ? ('succeeded' as const)
                : entry.state === 'failed'
                  ? ('failed' as const)
                  : ('cancelled' as const)
          }
        : {}),
      firstObservedAt: entry.startedAt ?? 0,
      observedAt: entry.settledAt ?? entry.startedAt ?? 0,
      settledAt: entry.settledAt,
      totalTokens: entry.tokens,
      lastMessage: entry.lastMessage,
      stoppable: false,
      invocation: { invocationId: entry.id, generation: 0 }
    })
  }
  // Provider identities join the durable roster to the current host-owned run.
  for (const view of live) {
    views.set(view.providerId ?? view.id, view)
  }
  for (const [id, view] of views) {
    const parent = parents.get(id)
    const parentView = parent ? views.get(parent) : undefined
    if (!view.parentChildWorkId && parentView && parentView.id !== view.id) {
      views.set(id, { ...view, parentChildWorkId: parentView.id })
    }
  }
  return buildAgentChildRowModels([...views.values()], context)
}
