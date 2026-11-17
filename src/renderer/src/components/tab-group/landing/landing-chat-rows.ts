import type { NewTabAgentMenuRow } from '../../../../../shared/agent-launch/picker/agent-launch-picker-rows'

export function landingChatRows(rows: readonly NewTabAgentMenuRow[]): NewTabAgentMenuRow[] {
  return rows.flatMap((row) =>
    row.kind === 'chat'
      ? [row]
      : row.kind === 'cli' && row.chat
        ? [{ kind: 'chat' as const, agent: row.agent, executionHostId: row.executionHostId }]
        : []
  )
}
