import type { RuntimeTerminalListResult } from '../../../../shared/terminal/runtime/runtime-terminal-contracts'
import { callHostRoute } from '@/runtime/rpc/calls/host-route-call'
import type { HostRoute } from '@/runtime/rpc/targets/runtime-client-target'
import {
  captureHostIdentityFence,
  isHostIdentityFenceCurrent
} from '@/runtime/rpc/environment-revisions/host-identity-fence'
import type { RuntimeStatus } from '../../../../shared/remote-runtime/session-graph/runtime-session-contracts'
import { TERMINAL_IDENTITY_FENCED_CLOSE_CAPABILITY } from '../../../../shared/terminal/runtime-policy/terminal-runtime-capabilities'

export async function readTerminalInventory(route: HostRoute): Promise<RuntimeTerminalListResult> {
  const fence = captureHostIdentityFence(route)
  const status = await callHostRoute<RuntimeStatus>(route, 'status.get')
  const read = (limit: number): Promise<RuntimeTerminalListResult> =>
    callHostRoute(route, 'terminal.list', {
      limit,
      requireFreshPtyLiveness: true,
      includeVisualLayouts: false,
      includePreview: false,
      includeAttention: true,
      placeUnshownLiveTerminals: false
    })
  let result = await read(200)
  if (
    result.truncated &&
    Number.isSafeInteger(result.totalCount) &&
    result.totalCount > result.terminals.length
  ) {
    result = await read(result.totalCount)
  }
  if (!isHostIdentityFenceCurrent(fence)) {
    throw new Error('The terminal owner changed. Refresh to reconnect.')
  }
  return status.capabilities?.includes(TERMINAL_IDENTITY_FENCED_CLOSE_CAPABILITY)
    ? result
    : {
        ...result,
        terminals: result.terminals.map((terminal) => ({ ...terminal, verdict: 'unverifiable' }))
      }
}
